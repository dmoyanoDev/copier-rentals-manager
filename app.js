// State Management
let state = {
    clients: [],
    machines: [],
    abonos: [],
    readings: [],
    maintenance: [],
    users: [],
    currentUser: null,
    settings: {
        reminder7Days: true,
        reminder3Days: true,
        reminder1Day: true
    }
};

// Current Active Tab
let currentTab = 'dashboard';
// Current Active Month (YYYY-MM format, default to current month or latest data month)
let currentMonth = '2026-06'; // realistic starting point matching metadata

// Chart instances
let chartEarningsInstance = null;
let chartMachinesInstance = null;

// DOM Elements
const tabs = document.querySelectorAll('.nav-item');
const tabSections = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const monthSelector = document.getElementById('global-month-select');

let recoveryUser = null; // Temp holder for password recovery

// Firebase Cloud variables
let db = null;
let firebaseActive = false;

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    window.sessionStartTimestamp = Date.now();
    // Set default month selector value
    monthSelector.value = currentMonth;
    
    // Load local state first for instant flicker-free rendering and session persistence
    loadFromLocalStorage();
    checkAuthSession();
    
    // Download latest cloud data in background if connected
    try {
        await loadDatabase();
        // Re-render UI with latest downloaded data
        renderApp();
        if (state.currentUser) {
            checkPopNotifications();
        }
    } catch (e) {
        console.error("Error loading database:", e);
    }
    
    // Set up Event Listeners
    setupNavigation();
    setupForms();
    setupActions();
    
    // Update logo preview in Data Management tab
    updateLogoPreview();
    
    // Wire up Firebase controls
    setupFirebaseControls();

    // Wire up Reports actions
    setupReports();

    // Wire up Rental Transitions
    setupRentalTransitions();
});

// Async function to load either from Firebase or LocalStorage
async function loadDatabase() {
    let config = null;
    const savedConfig = localStorage.getItem('firebase_config');
    
    if (savedConfig) {
        try {
            config = JSON.parse(savedConfig);
        } catch (e) {
            console.error(e);
        }
    } else if (typeof DEFAULT_FIREBASE_CONFIG !== 'undefined' && DEFAULT_FIREBASE_CONFIG !== null) {
        config = DEFAULT_FIREBASE_CONFIG;
    }

    if (config) {
        try {
            // Check if Firebase is loaded via SDK script
            if (typeof firebase !== 'undefined') {
                // Initialize app if not already initialized
                if (firebase.apps.length === 0) {
                    firebase.initializeApp(config);
                }
                db = firebase.firestore();
                firebaseActive = true;
                
                // Fetch state collections from Firestore
                await fetchCloudData();
                
                // Update UI badge & disconnect button
                updateFirebaseUI(true, config);

                // Real-time Firestore tickets listener for immediate technical alarms
                db.collection('tickets').onSnapshot(snapshot => {
                    let hasNewTicket = false;
                    snapshot.docChanges().forEach(change => {
                        const ticket = change.doc.data();
                        if (change.type === 'added') {
                            const isNew = ticket.createdAt && ticket.createdAt > (window.sessionStartTimestamp || Date.now() - 5000);
                            const alreadyExists = state.tickets.some(t => t.id === ticket.id);
                            if (isNew && !alreadyExists) {
                                hasNewTicket = true;
                            }
                            
                            // Upsert ticket
                            const idx = state.tickets.findIndex(t => t.id === ticket.id);
                            if (idx !== -1) {
                                state.tickets[idx] = ticket;
                            } else {
                                state.tickets.push(ticket);
                            }
                        } else if (change.type === 'modified') {
                            const idx = state.tickets.findIndex(t => t.id === ticket.id);
                            if (idx !== -1) {
                                const prevStatus = state.tickets[idx].status;
                                state.tickets[idx] = ticket;
                                if (prevStatus !== ticket.status && ticket.status !== 'no-visto') {
                                    showToast(`Área Técnica: El pedido de ${ticket.clientName || 'Cliente'} cambió a [${ticket.status.toUpperCase()}]`, 'info');
                                }
                            }
                        } else if (change.type === 'removed') {
                            state.tickets = state.tickets.filter(t => t.id !== ticket.id);
                        }
                    });
                    
                    if (hasNewTicket) {
                        playTechnicalAlertSound();
                        showToast('🔔 ¡NUEVO PEDIDO DE SERVICIO TÉCNICO REGISTRADO!', 'warning');
                    }
                    
                    saveToLocalStorage();
                    renderApp();
                });
                return;
            }
        } catch (err) {
            console.error("Error al inicializar Firebase en el arranque:", err);
            showToast("Error de conexión con Firebase. Cargando base de datos local.", "error");
        }
    }
    
    // Fallback to localStorage
    firebaseActive = false;
    loadFromLocalStorage();
    updateFirebaseUI(false);
}

// Function to fetch all collections from Firestore
async function fetchCloudData() {
    try {
        state.clients = await fetchCollection('clients');
        state.machines = await fetchCollection('machines');
        state.abonos = await fetchCollection('abonos');
        state.readings = await fetchCollection('readings');
        state.maintenance = await fetchCollection('maintenance') || [];
        state.users = await fetchCollection('users');
        state.tickets = await fetchCollection('tickets') || [];
        
        // Load company logo if stored in Firestore
        const logoDoc = await db.collection('settings').doc('companyLogo').get();
        if (logoDoc.exists) {
            state.companyLogo = logoDoc.data().value;
        } else {
            // fallback to local logo if present
            const localSaved = localStorage.getItem('copyrent_data');
            if (localSaved) {
                const localState = JSON.parse(localSaved);
                if (localState.companyLogo) {
                    state.companyLogo = localState.companyLogo;
                }
            }
        }
        
        // Safeguard user admin
        if (state.users.length === 0) {
            const defaultAdmin = {
                id: 'user-admin',
                username: 'dmoyano',
                fullname: 'Darío Moyano',
                email: 'dmoyano@mstecnologia.com.ar',
                password: 'Jueves2389$'
            };
            state.users = [defaultAdmin];
            await db.collection('users').doc(defaultAdmin.id).set(defaultAdmin);
        }
    } catch (e) {
        console.error("Error al descargar colecciones de Firebase:", e);
        throw e;
    }
}

async function fetchCollection(collectionName) {
    const snapshot = await db.collection(collectionName).get();
    const data = [];
    snapshot.forEach(doc => {
        data.push(doc.data());
    });
    return data;
}

function updateFirebaseUI(active, config = null) {
    const badge = document.getElementById('firebase-status-badge');
    const disconnectBtn = document.getElementById('btn-disconnect-firebase');
    const syncPanel = document.getElementById('firebase-sync-panel');
    
    if (active) {
        badge.textContent = 'Conectado (Nube)';
        badge.style.backgroundColor = 'var(--emerald)';
        disconnectBtn.style.display = 'inline-block';
        syncPanel.style.display = 'block';
        
        if (config) {
            document.getElementById('fb-api-key').value = config.apiKey || '';
            document.getElementById('fb-auth-domain').value = config.authDomain || '';
            document.getElementById('fb-project-id').value = config.projectId || '';
            document.getElementById('fb-storage-bucket').value = config.storageBucket || '';
            document.getElementById('fb-messaging-sender-id').value = config.messagingSenderId || '';
            document.getElementById('fb-app-id').value = config.appId || '';
        }
    } else {
        badge.textContent = 'Inactivo (Local)';
        badge.style.backgroundColor = 'var(--text-secondary-light)';
        disconnectBtn.style.display = 'none';
        syncPanel.style.display = 'none';
    }
}

// Firestore persistence wrappers
async function dbSet(collectionName, docId, data) {
    if (firebaseActive && db) {
        try {
            let cloudData = data;
            await db.collection(collectionName).doc(docId).set(cloudData);
        } catch (err) {
            console.error(`Error saving to Firestore (${collectionName}/${docId}):`, err);
            showToast('Error de sincronización con la nube', 'error');
        }
    }
    // Always persist to local cache for safety & offline support
    saveToLocalStorage();
}

async function dbDelete(collectionName, docId) {
    if (firebaseActive && db) {
        try {
            await db.collection(collectionName).doc(docId).delete();
        } catch (err) {
            console.error(`Error deleting from Firestore (${collectionName}/${docId}):`, err);
            showToast('Error al eliminar en la nube', 'error');
        }
    }
    saveToLocalStorage();
}

function checkAuthSession() {
    const loginContainer = document.getElementById('login-container');
    const resetPasswordContainer = document.getElementById('reset-password-container');
    const appContainer = document.querySelector('.app-container');

    if (!state.currentUser) {
        appContainer.style.display = 'none';
        resetPasswordContainer.style.display = 'none';
        loginContainer.style.display = 'flex';
    } else {
        loginContainer.style.display = 'none';
        resetPasswordContainer.style.display = 'none';
        appContainer.style.display = 'flex';

        // Update profile card in sidebar
        const nameEl = document.getElementById('user-display-name');
        const roleEl = document.getElementById('user-display-role');
        const initialsEl = document.getElementById('user-avatar-initials');

        const user = state.currentUser;
        nameEl.textContent = user.fullname;
        
        const userRole = user.role || 'administrativo';
        roleEl.textContent = userRole === 'tecnico' ? 'Técnico' : 'Administrativo';

        // Hide/show add machine button based on role
        const addMachineBtn = document.getElementById('btn-add-machine');
        if (addMachineBtn) {
            addMachineBtn.style.display = userRole === 'tecnico' ? 'none' : 'block';
        }
        
        // Filter sidebar navigation by role (technicians only see dashboard, technical area, and machines)
        const navItems = document.querySelectorAll('.nav-menu .nav-item');
        navItems.forEach(item => {
            const tabName = item.getAttribute('data-tab');
            if (userRole === 'tecnico') {
                if (tabName !== 'dashboard' && tabName !== 'technical-area' && tabName !== 'machines') {
                    item.style.display = 'none';
                } else {
                    item.style.display = 'flex';
                }
            } else {
                item.style.display = 'flex';
            }
        });
        
        // Generate initials
        const parts = user.fullname.split(' ');
        const initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
        initialsEl.textContent = initials || 'US';

        const mobileInitialsEl = document.getElementById('mobile-user-initials');
        if (mobileInitialsEl) {
            mobileInitialsEl.textContent = initials || 'US';
        }

        // Initial Render
        renderApp();
    }
}

// Load and Save helpers
function saveToLocalStorage() {
    localStorage.setItem('copyrent_data', JSON.stringify(state));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('copyrent_data');
    if (saved) {
        try {
            state = JSON.parse(saved);
            // Ensure array structures exist
            if (!state.clients) state.clients = [];
            if (!state.machines) state.machines = [];
            if (!state.abonos) state.abonos = [];
            if (!state.readings) state.readings = [];
            if (!state.maintenance) state.maintenance = [];
            if (!state.users) state.users = [];
            if (!state.tickets) state.tickets = [];
            if (state.currentUser === undefined) state.currentUser = null;
            if (!state.settings) {
                state.settings = {
                    reminder7Days: true,
                    reminder3Days: true,
                    reminder1Day: true
                };
            }
        } catch (e) {
            console.error('Error parsing localStorage data, reloading defaults', e);
            loadDemoData();
        }
    } else {
        loadDemoData();
    }
    
    // Ensure default master admin exists
    if (!state.users || state.users.length === 0) {
        state.users = [
            {
                id: 'user-admin',
                username: 'dmoyano',
                fullname: 'Darío Moyano',
                email: 'dmoyano@mstecnologia.com.ar',
                password: 'Jueves2389$',
                role: 'administrativo',
                phone: '5491133445566'
            }
        ];
    }

    // Migrate readings without clientId or abonoId
    let migrated = false;
    state.readings.forEach(r => {
        let changed = false;
        if (!r.clientId || !r.abonoId) {
            const machine = state.machines.find(m => m.id === r.machineId);
            if (machine) {
                if (!r.clientId && machine.clientId) {
                    r.clientId = machine.clientId;
                    changed = true;
                }
                if (!r.abonoId && machine.abonoId) {
                    r.abonoId = machine.abonoId;
                    changed = true;
                }
            }
        }
        if (changed) {
            dbSet('readings', r.id, r);
            migrated = true;
        }
    });
    if (migrated) {
        saveToLocalStorage();
    }
}

// Demo Data Setup
function loadDemoData() {
    // 1. Abonos (Plans)
    state.abonos = [
        {
            id: 'abono-1',
            name: 'Abono Estándar 3000 (Copias/Esc./Imp.)',
            limit: 3000,
            price: 119000,
            excessPrice: 49,
            ivaRate: 21
        },
        {
            id: 'abono-2',
            name: 'Abono Oficina Chico 1000',
            limit: 1000,
            price: 55000,
            excessPrice: 40,
            ivaRate: 21
        },
        {
            id: 'abono-3',
            name: 'Abono Corporativo 5000',
            limit: 5000,
            price: 180000,
            excessPrice: 45,
            ivaRate: 10.5
        }
    ];

    // 2. Clients
    state.clients = [
        {
            id: 'client-1',
            name: 'Estudio Contable Pérez & Asociados',
            phone: '11 4822-9012',
            email: 'contacto@estudioperez.com.ar',
            address: 'Av. Corrientes 1540, Piso 4, CABA',
            notes: 'Facturar del 1 al 5 de cada mes sin falta.'
        },
        {
            id: 'client-2',
            name: 'Imprenta Grafic-Art',
            phone: '11 5900-2415',
            email: 'graficart.ventas@gmail.com',
            address: 'Ituzaingó 845, Lanús Oeste, PBA',
            notes: 'Alta exigencia en calidad de impresión.'
        },
        {
            id: 'client-3',
            name: 'Colegio San Martín',
            phone: '11 4799-8800',
            email: 'administracion@sanmartin.edu.ar',
            address: 'San Martín 1250, Vicente López, PBA',
            notes: 'Cargan muchas copias al final del trimestre.'
        }
    ];

    // 3. Machines (with installation dates, counters, brands, and conditions)
    state.machines = [
        {
            id: 'machine-1',
            brand: 'Ricoh',
            model: 'MP 301',
            serial: 'W38190342',
            type: 'Multifunción',
            status: 'En Servicio',
            clientId: 'client-1',
            abonoId: 'abono-2', // Oficina Chico 1000
            installationDate: '2026-03-15',
            initialCounter: 10500,
            machineCounter: 12620,
            applyIva: true
        },
        {
            id: 'machine-2',
            brand: 'Konica Minolta',
            model: 'bizhub C224e',
            serial: 'A3GP02100438',
            type: 'Multifunción',
            status: 'Usado',
            clientId: 'client-2',
            abonoId: 'abono-1', // Estándar 3000
            installationDate: '2025-11-10',
            initialCounter: 35000,
            machineCounter: 41750,
            applyIva: true
        },
        {
            id: 'machine-3',
            brand: 'HP',
            model: 'LaserJet Enterprise M506',
            serial: 'CNB1L99240',
            type: 'Impresora',
            status: 'Nuevo',
            clientId: 'client-3',
            abonoId: 'abono-1', // Estándar 3000
            installationDate: '2026-01-20',
            initialCounter: 82000,
            machineCounter: 84900,
            applyIva: false
        },
        {
            id: 'machine-4',
            brand: 'Ricoh',
            model: 'MP 4002',
            serial: 'W49200384',
            type: 'Multifunción',
            status: 'Usado',
            clientId: '',
            abonoId: '',
            installationDate: '',
            initialCounter: 0,
            machineCounter: 45000,
            applyIva: false
        }
    ];

    // 4. Readings (Preload some historical and current month readings)
    state.readings = [
        // May 2026 (Previous Month)
        {
            id: 'read-may-1',
            machineId: 'machine-1',
            month: '2026-05',
            initial: 10500,
            final: 11450, // 950 copies (within 1000 limit)
            status: 'paid'
        },
        {
            id: 'read-may-2',
            machineId: 'machine-2',
            month: '2026-05',
            initial: 35000,
            final: 38200, // 3200 copies (exceeded by 200) -> $119000 + 200 * $49 = $128,800
            status: 'paid'
        },
        {
            id: 'read-may-3',
            machineId: 'machine-3',
            month: '2026-05',
            initial: 82000,
            final: 84900, // 2700 copies (within 3000 limit)
            status: 'paid'
        },
        
        // June 2026 (Current Month selected in UI)
        {
            id: 'read-jun-1',
            machineId: 'machine-1',
            month: '2026-06',
            initial: 11450, // carries over from May final
            final: 12620, // 1170 copies (exceeded by 170) -> $55000 + 170 * $40 = $61,800
            status: 'paid'
        },
        {
            id: 'read-jun-2',
            machineId: 'machine-2',
            month: '2026-06',
            initial: 38200, // carries over from May final
            final: 41750, // 3550 copies (exceeded by 550) -> $119000 + 550 * $49 = $119000 + $26,950 = $145,950
            status: 'pending'
        }
        // Machine 3 (Colegio San Martín) doesn't have a June reading logged yet, to show "pending reading"
    ];

    // 5. Maintenance / Supplies & Parts History
    state.maintenance = [
        {
            id: 'maint-1',
            machineId: 'machine-2',
            date: '2026-02-14',
            type: 'Insumo',
            description: 'Cambio de Tóner Negro TN-216',
            counter: 36200
        },
        {
            id: 'maint-2',
            machineId: 'machine-2',
            date: '2026-05-18',
            type: 'Repuesto',
            description: 'Reemplazo Rodillo Fusor Superior',
            counter: 38400
        },
        {
            id: 'maint-3',
            machineId: 'machine-1',
            date: '2026-04-10',
            type: 'Insumo',
            description: 'Cambio de Tóner Negro MP301',
            counter: 11200
        }
    ];

    state.tickets = [];
    saveToLocalStorage();
}

// Navigation Tabs Toggle
function setupNavigation() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.getAttribute('data-tab');
            currentTab = tabName;
            
            tabSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `tab-${tabName}`) {
                    section.classList.add('active');
                }
            });

            // Update Page Titles dynamically
            updateTitleText(tabName);
            
            // Re-render only active tab elements to optimize
            renderApp();
        });
    });
    // Month Selector Change
    monthSelector.addEventListener('change', (e) => {
        currentMonth = e.target.value;
        renderApp();
        showToast(`Cambiado al período: ${formatPeriod(currentMonth)}`, 'info');
    });
}

function updateTitleText(tabName) {
    switch (tabName) {
        case 'dashboard':
            pageTitle.textContent = 'Panel de Control';
            pageSubtitle.textContent = 'Información y rendimiento general de alquileres';
            break;
        case 'rentals':
            pageTitle.textContent = 'Alquileres Activos';
            pageSubtitle.textContent = 'Listado consolidado de alquileres y expedientes de equipos por cliente';
            break;
        case 'readings':
            pageTitle.textContent = 'Lecturas y Facturación';
            pageSubtitle.textContent = 'Control de contadores mensuales y estado de cobros';
            break;
        case 'history':
            pageTitle.textContent = 'Historial de Facturación';
            pageSubtitle.textContent = 'Historial completo de lecturas, consumos y pagos mensuales';
            break;
        case 'clients':
            pageTitle.textContent = 'Gestión de Clientes';
            pageSubtitle.textContent = 'Directorio de clientes y datos de facturación';
            break;
        case 'machines':
            pageTitle.textContent = 'Gestión de Máquinas';
            pageSubtitle.textContent = 'Listado e inventario de fotocopiadoras e impresoras';
            break;
        case 'abonos':
            pageTitle.textContent = 'Abonos y Tarifas';
            pageSubtitle.textContent = 'Configuración de planes base mensuales y tarifas excedentes';
            break;
        case 'users':
            pageTitle.textContent = 'Gestión de Usuarios';
            pageSubtitle.textContent = 'Administración de usuarios que ingresan al sistema';
            break;
        case 'data-management':
            pageTitle.textContent = 'Respaldos y Configuración';
            pageSubtitle.textContent = 'Herramientas de exportación, importación y demostración';
            break;
        case 'technical-area':
            pageTitle.textContent = 'Área Técnica - Soporte';
            pageSubtitle.textContent = 'Pedidos de servicio técnico, insumos y repuestos registrados';
            break;
    }
}

function renderApp() {
    const userRole = state.currentUser ? (state.currentUser.role || 'administrativo') : 'administrativo';
    if (userRole === 'tecnico') {
        if (currentTab !== 'dashboard' && currentTab !== 'technical-area' && currentTab !== 'machines') {
            currentTab = 'dashboard';
            tabs.forEach(t => {
                if (t.getAttribute('data-tab') === 'dashboard') {
                    t.classList.add('active');
                } else {
                    t.classList.remove('active');
                }
            });
            tabSections.forEach(section => {
                if (section.id === 'tab-dashboard') {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
            updateTitleText('dashboard');
        }
    }

    switch (currentTab) {
        case 'dashboard':
            renderDashboardTab();
            break;
        case 'rentals':
            renderRentalsTab();
            break;
        case 'readings':
            renderReadingsTab();
            break;
        case 'history':
            renderHistoryTab();
            break;
        case 'clients':
            renderClientsTab();
            break;
        case 'machines':
            renderMachinesTab();
            break;
        case 'abonos':
            renderAbonosTab();
            break;
        case 'users':
            renderUsersTab();
            break;
        case 'data-management':
            renderDataManagementTab();
            break;
        case 'technical-area':
            renderTechnicalAreaTab();
            break;
    }
}

function renderDataManagementTab() {
    const notify7DaysCheckbox = document.getElementById('setting-notify-7days');
    const notify3DaysCheckbox = document.getElementById('setting-notify-3days');
    const notify1DayCheckbox = document.getElementById('setting-notify-1day');
    
    if (notify7DaysCheckbox && notify3DaysCheckbox && notify1DayCheckbox) {
        notify7DaysCheckbox.checked = state.settings?.reminder7Days !== false;
        notify3DaysCheckbox.checked = state.settings?.reminder3Days !== false;
        notify1DayCheckbox.checked = state.settings?.reminder1Day !== false;
    }
}

// Tab View: Rentals Tab (Alquileres Activos)
function renderRentalsTab() {
    const gridContainer = document.getElementById('rentals-grid-container');
    gridContainer.innerHTML = '';

    const searchVal = document.getElementById('search-rentals').value.toLowerCase();

    // Get clients with at least one active machine rental
    const activeClients = state.clients.filter(client => {
        const clientMachines = state.machines.filter(m => m.clientId === client.id);
        if (clientMachines.length === 0) return false;

        // Search filter matches client name or machine brand/model
        const matchesClient = client.name.toLowerCase().includes(searchVal);
        const matchesMachines = clientMachines.some(m => 
            `${m.brand || ''} ${m.model}`.toLowerCase().includes(searchVal) ||
            m.serial.toLowerCase().includes(searchVal)
        );
        return matchesClient || matchesMachines;
    });

    if (activeClients.length === 0) {
        gridContainer.innerHTML = `<div class="text-center py-5" style="color: var(--text-secondary-light);">No se encontraron alquileres activos con los filtros indicados.</div>`;
        return;
    }

    activeClients.forEach(client => {
        const clientMachines = state.machines.filter(m => m.clientId === client.id);
        
        const clientCard = document.createElement('div');
        clientCard.className = 'dashboard-card';
        clientCard.style.marginTop = '20px';
        clientCard.style.padding = '20px';
        clientCard.style.backgroundColor = 'var(--bg-secondary)';
        clientCard.style.border = '1px solid var(--border-color)';
        clientCard.style.borderRadius = '16px';

        let machinesHtml = '';
        clientMachines.forEach(m => {
            const abono = state.abonos.find(a => a.id === m.abonoId);
            const abonoName = abono ? abono.name : 'Sin abono';
            const ivaRate = m.applyIva && abono ? (abono.ivaRate || 0) : 0;
            const ivaLabel = m.applyIva && ivaRate > 0 ? `IVA ${ivaRate}%` : 'No IVA';
            const totalFixed = abono ? abono.price * (1 + ivaRate / 100) : 0;

            // Get readings for this machine
            const machineReadings = state.readings.filter(r => r.machineId === m.id);
            machineReadings.sort((a, b) => b.month.localeCompare(a.month));

            let readingsRowsHtml = '';
            if (machineReadings.length === 0) {
                readingsRowsHtml = `<tr><td colspan="5" class="text-center text-secondary-light py-3">Sin lecturas cargadas</td></tr>`;
            } else {
                machineReadings.forEach(r => {
                    const diff = Math.max(0, r.final - r.initial);
                    const exc = abono ? Math.max(0, diff - abono.limit) : 0;
                    const fixedCost = abono ? abono.price : 0;
                    const excessCost = abono ? exc * abono.excessPrice : 0;
                    const net = fixedCost + excessCost;
                    const ivaCost = net * (ivaRate / 100);
                    const total = net + ivaCost;
                    
                    readingsRowsHtml += `
                        <tr>
                            <td><strong>${formatPeriod(r.month)}</strong></td>
                            <td>${r.initial.toLocaleString('es-AR')} - ${r.final.toLocaleString('es-AR')}</td>
                            <td><strong>${diff.toLocaleString('es-AR')}</strong></td>
                            <td><strong class="text-indigo">${formatCurrency(total)}</strong></td>
                            <td>
                                <button class="btn btn-primary btn-sm" onclick="viewInvoiceTrigger('${r.id}')" style="font-size:10px; padding:2px 6px;">Recibo</button>
                            </td>
                        </tr>
                    `;
                });
            }

            // Get maintenance for this machine
            const machineMaint = state.maintenance.filter(mn => mn.machineId === m.id);
            machineMaint.sort((a, b) => b.date.localeCompare(a.date));

            let maintRowsHtml = '';
            if (machineMaint.length === 0) {
                maintRowsHtml = `<div class="text-center text-secondary-light py-4" style="font-size:12px;">Sin registros técnicos</div>`;
            } else {
                machineMaint.forEach(mn => {
                    maintRowsHtml += `
                        <div style="padding: 6px; border-bottom: 1px dashed rgba(0,0,0,0.05); font-size:12px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                                <span class="badge ${mn.type === 'Repuesto' ? 'danger' : 'warning'}" style="font-size:9px; padding:1px 4px;">${mn.type}</span>
                                <strong>${mn.date.split('-').reverse().join('/')}</strong>
                            </div>
                            <div class="font-bold-title">${mn.description}</div>
                            <span class="text-xs text-secondary-light d-block">Contador: ${mn.counter.toLocaleString('es-AR')} copias</span>
                        </div>
                    `;
                });
            }

            machinesHtml += `
                <div style="border: 1px solid var(--border-color); padding: 20px; border-radius: 12px; background: rgba(0,0,0,0.01); margin-top: 15px;">
                    <div style="display:grid; grid-template-columns: 1.2fr 1.4fr 1.4fr; gap:20px;">
                        
                        <!-- Col 1: General Info -->
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom: 1px solid var(--border-color); padding-bottom:8px;">
                                <strong style="font-size:15px; color:var(--text-primary);">${m.brand || ''} ${m.model}</strong>
                                <span class="badge ${m.status === 'Nuevo' ? 'success' : 'bg-indigo-light text-indigo'}" style="font-size:10px; padding:2px 6px;">${m.status}</span>
                            </div>
                            <table class="table-info" style="width:100%; font-size:12px; border-collapse:collapse;">
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.03);"><td style="font-weight:600; color:var(--text-secondary-light); padding:4px 0;">Serie:</td><td style="font-family:monospace; text-align:right; font-weight:500;">${m.serial}</td></tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.03);"><td style="font-weight:600; color:var(--text-secondary-light); padding:4px 0;">Contador Actual:</td><td style="text-align:right; font-weight:600; color:var(--primary);">${(m.machineCounter || 0).toLocaleString('es-AR')}</td></tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.03);"><td style="font-weight:600; color:var(--text-secondary-light); padding:4px 0;">Abono mensual:</td><td style="text-align:right; font-weight:500;">${formatCurrency(totalFixed)}</td></tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.03);"><td style="font-weight:600; color:var(--text-secondary-light); padding:4px 0;">Detalle Plan:</td><td style="text-align:right; font-size:11px;">${abonoName} (${abono ? abono.limit : 0} cop.)</td></tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.03);"><td style="font-weight:600; color:var(--text-secondary-light); padding:4px 0;">Instalación:</td><td style="text-align:right;">${m.installationDate ? m.installationDate.split('-').reverse().join('/') : '-'}</td></tr>
                                <tr><td style="font-weight:600; color:var(--text-secondary-light); padding:4px 0;">Disponibilidad:</td><td style="text-align:right; font-weight:500;">${m.isAvailable !== false ? 'Disponible' : 'No Disponible'}</td></tr>
                            </table>
                            <div style="margin-top:15px; display:flex; flex-direction:column; gap:6px;">
                                <div style="display:flex; gap:6px;">
                                    <button class="btn btn-primary btn-sm flex-1" onclick="openReadingModal('${m.id}', currentMonth)" style="font-size:11px; padding:5px; justify-content:center; white-space:nowrap;">+ Lectura</button>
                                    <button class="btn btn-secondary btn-sm flex-1" onclick="openAddMaintenanceTrigger('${m.id}')" style="font-size:11px; padding:5px; justify-content:center; white-space:nowrap;">+ Service</button>
                                </div>
                                <button class="btn btn-secondary btn-sm" onclick="openRentalDetailModal('${m.id}')" style="font-size:11px; padding:6px; justify-content:center; width:100%; display:flex; align-items:center; gap:4px; font-weight:600;">📂 Ver Expediente de Alquiler</button>
                            </div>
                        </div>

                        <!-- Col 2: Readings Log -->
                        <div>
                            <div style="margin-bottom:10px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                                <strong style="font-size:13px; color:var(--text-secondary);">Últimas Lecturas y Cobros</strong>
                            </div>
                            <div class="table-container" style="max-height:175px; overflow-y:auto; border:1px solid rgba(0,0,0,0.05); border-radius:8px;">
                                <table class="table" style="font-size:11px; margin-bottom:0; width:100%;">
                                    <thead>
                                        <tr>
                                            <th>Mes</th>
                                            <th>Rango Cont.</th>
                                            <th>Cons.</th>
                                            <th>Total</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${readingsRowsHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Col 3: Maintenance Log -->
                        <div>
                            <div style="margin-bottom:10px; border-bottom:1px solid var(--border-color); padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                                <strong style="font-size:13px; color:var(--text-secondary);">Bitácora de Servicio</strong>
                                ${m.clientId ? `<button class="btn btn-secondary btn-sm" onclick="openMaintenanceHistoryTrigger('${m.id}')" style="font-size:10px; padding:2px 6px; height:auto;">Ver Todo</button>` : ''}
                            </div>
                            <div style="max-height:175px; overflow-y:auto; border:1px solid rgba(0,0,0,0.05); border-radius:8px; padding:8px; background:rgba(0,0,0,0.005); display:flex; flex-direction:column; gap:6px;">
                                ${maintRowsHtml}
                            </div>
                        </div>

                    </div>
                </div>
            `;
        });

        clientCard.innerHTML = `
            <div class="card-header" style="border-bottom:1px solid var(--border-color); padding-bottom:10px; margin-bottom:0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h3 style="margin:0; font-size:16px; color:var(--primary); font-weight:700;">${client.name}</h3>
                    <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-secondary-light);">📞 ${client.phone || '-'} | ✉️ ${client.email || '-'} | 📍 ${client.address || '-'}</p>
                </div>
                <span class="badge success" style="font-size:11px; padding:4px 8px;">${clientMachines.length} Equipo(s)</span>
            </div>
            <div class="card-body" style="padding:0;">
                ${machinesHtml}
            </div>
        `;
        gridContainer.appendChild(clientCard);
    });

    // Search listener wiring
    const rentalsSearchInput = document.getElementById('search-rentals');
    if (!rentalsSearchInput.hasAttribute('data-wired')) {
        rentalsSearchInput.setAttribute('data-wired', 'true');
        rentalsSearchInput.addEventListener('input', renderRentalsTab);
    }
}

window.openRentalDetailModal = (machineId) => {
    closeAllModals();
    const machine = state.machines.find(m => m.id === machineId);
    if (!machine) return;
    const client = state.clients.find(c => c.id === machine.clientId);
    const abono = state.abonos.find(a => a.id === machine.abonoId);

    // Bind action buttons inside modal
    document.getElementById('btn-rental-detail-add-reading').onclick = () => {
        openReadingModal(machineId, currentMonth);
    };
    document.getElementById('btn-rental-detail-add-maint').onclick = () => {
        openAddMaintenanceTrigger(machineId);
    };

    const isTech = state.currentUser?.role === 'tecnico';
    const endRentalBtn = document.getElementById('btn-rental-end');
    const changeMachineBtn = document.getElementById('btn-rental-change-machine');

    if (endRentalBtn) {
        endRentalBtn.style.display = isTech ? 'none' : 'inline-block';
        endRentalBtn.onclick = () => openEndRentalModal(machineId);
    }
    if (changeMachineBtn) {
        changeMachineBtn.style.display = isTech ? 'none' : 'inline-block';
        changeMachineBtn.onclick = () => openChangeMachineModal(machineId);
    }

    const titleEl = document.getElementById('rental-detail-title');
    const subtitleEl = document.getElementById('rental-detail-subtitle');

    titleEl.textContent = `Expediente: ${machine.brand || ''} ${machine.model}`;
    subtitleEl.textContent = client ? `Alquilado a: ${client.name} (S/N: ${machine.serial})` : `Sin cliente asignado (S/N: ${machine.serial})`;

    // Reset tab state in modal
    const firstTabBtn = document.querySelector('.modal-tab-btn[data-modal-tab="rent-info"]');
    if (firstTabBtn) firstTabBtn.click();

    // Fill general data
    document.getElementById('rental-info-model').textContent = `${machine.brand || ''} ${machine.model}`;
    document.getElementById('rental-info-serial').textContent = machine.serial;
    document.getElementById('rental-info-type').textContent = machine.type;
    document.getElementById('rental-info-status').textContent = machine.status;
    document.getElementById('rental-info-availability').textContent = machine.isAvailable !== false ? 'Disponible para Venta o Alquiler' : 'No Disponible';
    document.getElementById('rental-info-counter').textContent = (machine.machineCounter || 0).toLocaleString('es-AR') + ' copias';

    if (abono) {
        const ivaRate = machine.applyIva ? (abono.ivaRate || 0) : 0;
        const ivaLabel = machine.applyIva && ivaRate > 0 ? `${ivaRate}%` : 'No IVA';
        const totalFixed = abono.price * (1 + ivaRate / 100);

        document.getElementById('rental-info-plan').textContent = abono.name;
        document.getElementById('rental-info-price').textContent = `${formatCurrency(abono.price)} (Base)`;
        document.getElementById('rental-info-limit').textContent = abono.limit.toLocaleString('es-AR') + ' copias';
        document.getElementById('rental-info-excess').textContent = `${formatCurrency(abono.excessPrice)} por copia`;
        document.getElementById('rental-info-iva').textContent = `${ivaLabel} (Abono fijo final: ${formatCurrency(totalFixed)})`;
        document.getElementById('rental-info-install-date').textContent = machine.installationDate ? machine.installationDate.split('-').reverse().join('/') : 'N/A';
        document.getElementById('rental-info-install-counter').textContent = machine.initialCounter ? machine.initialCounter.toLocaleString('es-AR') + ' copias' : '0';
    } else {
        document.getElementById('rental-info-plan').textContent = '-';
        document.getElementById('rental-info-price').textContent = '-';
        document.getElementById('rental-info-limit').textContent = '-';
        document.getElementById('rental-info-excess').textContent = '-';
        document.getElementById('rental-info-iva').textContent = '-';
        document.getElementById('rental-info-install-date').textContent = '-';
        document.getElementById('rental-info-install-counter').textContent = '-';
    }

    // Fill readings history
    const readingsTableBody = document.querySelector('#rental-readings-table tbody');
    readingsTableBody.innerHTML = '';
    const machineReadings = state.readings.filter(r => r.machineId === machineId);
    machineReadings.sort((a, b) => b.month.localeCompare(a.month));

    if (machineReadings.length === 0) {
        readingsTableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-secondary-light">No hay lecturas registradas para este equipo.</td></tr>`;
    } else {
        machineReadings.forEach(r => {
            const diff = Math.max(0, r.final - r.initial);
            const exc = abono ? Math.max(0, diff - abono.limit) : 0;
            const fixedCost = abono ? abono.price : 0;
            const excessCost = abono ? exc * abono.excessPrice : 0;
            const net = fixedCost + excessCost;
            const ivaRate = machine.applyIva && abono ? (abono.ivaRate || 0) : 0;
            const ivaCost = net * (ivaRate / 100);
            const total = net + ivaCost;

            const statusBadge = r.status === 'paid' 
                ? `<span class="badge success">Cobrado</span>`
                : `<span class="badge warning">Pendiente</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${formatPeriod(r.month)}</strong></td>
                <td>${r.initial.toLocaleString('es-AR')}</td>
                <td>${r.final.toLocaleString('es-AR')}</td>
                <td><strong>${diff.toLocaleString('es-AR')}</strong></td>
                <td class="${exc > 0 ? 'text-amber font-semibold' : ''}">${exc.toLocaleString('es-AR')}</td>
                <td>${formatCurrency(ivaCost)} <span class="text-xs text-secondary-light">(${ivaRate > 0 ? ivaRate + '%' : 'No IVA'})</span></td>
                <td><strong class="text-indigo">${formatCurrency(total)}</strong></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewInvoiceTrigger('${r.id}')" style="font-size:11px; padding: 4px 8px;">Recibo</button>
                </td>
            `;
            readingsTableBody.appendChild(row);
        });
    }

    // Fill maintenance history
    const maintTableBody = document.querySelector('#rental-maint-table tbody');
    maintTableBody.innerHTML = '';
    const machineMaint = state.maintenance.filter(m => m.machineId === machineId);
    machineMaint.sort((a, b) => b.date.localeCompare(a.date));

    if (machineMaint.length === 0) {
        maintTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-secondary-light">No hay registros de servicio técnico para este equipo.</td></tr>`;
    } else {
        machineMaint.forEach(m => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${m.date.split('-').reverse().join('/')}</td>
                <td><span class="badge ${m.type === 'Repuesto' ? 'danger' : 'warning'}">${m.type}</span></td>
                <td class="font-bold-title">${m.description}</td>
                <td>${(m.counter || 0).toLocaleString('es-AR')} copias</td>
            `;
            maintTableBody.appendChild(row);
        });
    }

    document.getElementById('modal-rental-detail').style.display = 'block';
};

// Form logic and submissions
function setupForms() {
    // Client Form
    document.getElementById('form-client').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('client-id').value;
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const email = document.getElementById('client-email').value;
        const address = document.getElementById('client-address').value;
        const notes = document.getElementById('client-notes').value;

        let clientData;
        if (id) {
            // Edit
            const idx = state.clients.findIndex(c => c.id === id);
            if (idx !== -1) {
                clientData = { id, name, phone, email, address, notes };
                state.clients[idx] = clientData;
                showToast('Cliente actualizado con éxito', 'success');
            }
        } else {
            // Create
            const newId = 'client-' + Date.now();
            clientData = { id: newId, name, phone, email, address, notes };
            state.clients.push(clientData);
            showToast('Cliente registrado con éxito', 'success');
        }

        if (clientData) {
            dbSet('clients', clientData.id, clientData);
        }
        closeAllModals();
        renderApp();
    });

    // Machine Form
    document.getElementById('form-machine').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('machine-id').value;
        const brand = document.getElementById('machine-brand').value;
        const model = document.getElementById('machine-model').value;
        const serial = document.getElementById('machine-serial').value;
        const type = document.getElementById('machine-type').value;
        const status = document.getElementById('machine-status').value;
        const machineCounter = parseInt(document.getElementById('machine-counter').value) || 0;
        const clientId = document.getElementById('machine-client-id').value;
        const abonoId = document.getElementById('machine-abono-id').value;
        const installationDate = document.getElementById('machine-install-date').value;
        const initialCounter = parseInt(document.getElementById('machine-install-counter').value) || 0;
        const applyIva = document.getElementById('machine-apply-iva').checked;
        const isAvailable = document.getElementById('machine-availability').value === 'true';
        const readingDay = parseInt(document.getElementById('machine-reading-day').value) || 10;

        let finalStatus = status;
        if (status === 'Nuevo' && machineCounter > 0) {
            finalStatus = 'Usado';
            showToast('El equipo era Nuevo y al tener contador mayor a 0, cambió a Usado automáticamente', 'info');
        }

        const machineData = {
            id: id || ('machine-' + Date.now()),
            brand,
            model,
            serial,
            type,
            status: finalStatus,
            machineCounter,
            clientId: clientId || '',
            abonoId: abonoId || '',
            installationDate: clientId ? (installationDate || new Date().toISOString().split('T')[0]) : '',
            initialCounter: clientId ? initialCounter : 0,
            applyIva: clientId ? applyIva : false,
            readingDay: clientId ? readingDay : 10,
            isAvailable
        };

        if (id) {
            const idx = state.machines.findIndex(m => m.id === id);
            if (idx !== -1) {
                state.machines[idx] = machineData;
                showToast('Máquina actualizada con éxito', 'success');
            }
        } else {
            state.machines.push(machineData);
            showToast('Máquina agregada con éxito', 'success');
        }

        dbSet('machines', machineData.id, machineData);
        closeAllModals();
        renderApp();
    });

    // Sync machine status with availability
    document.getElementById('machine-status').addEventListener('change', (e) => {
        const status = e.target.value;
        const availSelect = document.getElementById('machine-availability');
        if (status === 'Scrap' || status === 'No funciona') {
            availSelect.value = 'false';
            availSelect.disabled = true;
            showToast('Los equipos Scrap o No Funcionales se marcan como No Disponibles automáticamente', 'info');
        } else {
            availSelect.disabled = false;
        }
    });

    // Abono Form
    document.getElementById('form-abono').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('abono-id').value;
        const name = document.getElementById('abono-name').value;
        const limit = parseInt(document.getElementById('abono-limit').value) || 0;
        const price = parseFloat(document.getElementById('abono-price').value) || 0;
        const excessPrice = parseFloat(document.getElementById('abono-excess-price').value) || 0;
        const ivaRate = parseFloat(document.getElementById('abono-iva').value) || 0;

        const abonoData = { id: id || ('abono-' + Date.now()), name, limit, price, excessPrice, ivaRate };

        if (id) {
            const idx = state.abonos.findIndex(a => a.id === id);
            if (idx !== -1) {
                state.abonos[idx] = abonoData;
                showToast('Abono actualizado con éxito', 'success');
            }
        } else {
            state.abonos.push(abonoData);
            showToast('Abono registrado con éxito', 'success');
        }

        dbSet('abonos', abonoData.id, abonoData);
        closeAllModals();
        renderApp();
    });

    // Reading Form
    document.getElementById('form-reading').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('reading-id').value;
        const machineId = document.getElementById('reading-machine-id').value;
        const month = document.getElementById('reading-month').value;
        const initial = parseInt(document.getElementById('reading-initial').value) || 0;
        const final = parseInt(document.getElementById('reading-final').value) || 0;
        const status = document.getElementById('reading-status').value;

        if (final < initial) {
            showToast('La lectura final no puede ser menor a la lectura inicial', 'error');
            return;
        }

        const machine = state.machines.find(m => m.id === machineId);
        let resolvedClientId = '';
        let resolvedAbonoId = '';
        if (id) {
            const existingReading = state.readings.find(r => r.id === id);
            if (existingReading) {
                resolvedClientId = existingReading.clientId;
                resolvedAbonoId = existingReading.abonoId;
            }
        }
        if (!resolvedClientId && machine) {
            resolvedClientId = machine.clientId || '';
        }
        if (!resolvedAbonoId && machine) {
            resolvedAbonoId = machine.abonoId || '';
        }

        const invoiceNumber = document.getElementById('reading-invoice-number').value.trim();
        const isUnofficial = document.getElementById('reading-is-unofficial').checked;
        const creditNote = parseFloat(document.getElementById('reading-credit-note').value) || 0;
        const creditNoteReason = document.getElementById('reading-credit-note-reason').value.trim();
        const debitNote = parseFloat(document.getElementById('reading-debit-note').value) || 0;
        const debitNoteReason = document.getElementById('reading-debit-note-reason').value.trim();
        
        let invoiceFile = window.tempReadingFileBase64 || '';
        if (id && !invoiceFile) {
            const existingReading = state.readings.find(r => r.id === id);
            if (existingReading && existingReading.invoiceFile) {
                invoiceFile = existingReading.invoiceFile;
            }
        }

        const readingData = {
            id: id || ('read-' + Date.now()),
            machineId,
            clientId: resolvedClientId,
            abonoId: resolvedAbonoId,
            month,
            initial,
            final,
            status,
            invoiceNumber,
            isUnofficial,
            creditNote,
            creditNoteReason,
            debitNote,
            debitNoteReason,
            invoiceFile
        };

        if (id) {
            const existingReading = state.readings.find(r => r.id === id);
            if (existingReading) {
                readingData.partialPaid = existingReading.partialPaid || 0;
                readingData.paymentMethod = existingReading.paymentMethod || '';
                readingData.paymentReference = existingReading.paymentReference || '';
                readingData.paymentDate = existingReading.paymentDate || '';
                readingData.bankReconciled = existingReading.bankReconciled || false;
                readingData.bankReconciliationDate = existingReading.bankReconciliationDate || '';
            }
        }
        window.tempReadingFileBase64 = '';

        if (id) {
            const idx = state.readings.findIndex(r => r.id === id);
            if (idx !== -1) {
                state.readings[idx] = readingData;
                showToast('Lectura modificada correctamente', 'success');
            }
        } else {
            state.readings.push(readingData);
            showToast('Lectura registrada con éxito', 'success');
        }

        dbSet('readings', readingData.id, readingData);

        // Propagate logged final counter to update active machine current counter record
        const machineIdx = state.machines.findIndex(m => m.id === machineId);
        if (machineIdx !== -1) {
            let machine = state.machines[machineIdx];
            machine.machineCounter = final;
            if (machine.status === 'Nuevo' && final > 0) {
                machine.status = 'Usado';
                showToast('El equipo era Nuevo y al tener contador mayor a 0, cambió a Usado automáticamente', 'info');
            }
            dbSet('machines', machineId, machine);
        }

        closeAllModals();
        renderApp();
    });

    // Realtime calculators inside the reading modal
    const initialInput = document.getElementById('reading-initial');
    const finalInput = document.getElementById('reading-final');
    
    const calculateModalValues = () => {
        const initial = parseInt(initialInput.value) || 0;
        const final = parseInt(finalInput.value) || 0;
        const machineId = document.getElementById('reading-machine-id').value;
        
        const machine = state.machines.find(m => m.id === machineId);
        if (!machine) return;
        const abono = state.abonos.find(a => a.id === machine.abonoId);
        if (!abono) return;

        const isUnofficial = document.getElementById('reading-is-unofficial').checked;
        const creditNote = parseFloat(document.getElementById('reading-credit-note').value) || 0;
        const debitNote = parseFloat(document.getElementById('reading-debit-note').value) || 0;

        const copies = Math.max(0, final - initial);
        const excess = Math.max(0, copies - abono.limit);
        const fixedFee = abono.price;
        const excessFee = excess * abono.excessPrice;
        const netCost = fixedFee + excessFee;
        const ivaRate = (!isUnofficial && machine.applyIva) ? (abono.ivaRate || 0) : 0;
        const ivaCost = netCost * (ivaRate / 100);
        const total = netCost + ivaCost - creditNote + debitNote;

        document.getElementById('calc-copies').textContent = copies.toLocaleString('es-AR');
        document.getElementById('calc-excess').textContent = excess.toLocaleString('es-AR');
        document.getElementById('calc-limit').textContent = abono.limit.toLocaleString('es-AR');
        document.getElementById('calc-fixed-fee').textContent = formatCurrency(fixedFee);
        document.getElementById('calc-excess-rate').textContent = formatCurrency(abono.excessPrice);
        document.getElementById('calc-excess-fee').textContent = formatCurrency(excessFee);
        document.getElementById('calc-total').textContent = formatCurrency(total);
    };

    initialInput.addEventListener('input', calculateModalValues);
    finalInput.addEventListener('input', calculateModalValues);
    document.getElementById('reading-is-unofficial').addEventListener('change', calculateModalValues);
    document.getElementById('reading-credit-note').addEventListener('input', calculateModalValues);
    document.getElementById('reading-debit-note').addEventListener('input', calculateModalValues);

    const fileInput = document.getElementById('reading-invoice-file');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                window.tempReadingFileBase64 = '';
                document.getElementById('reading-invoice-file-preview').style.display = 'none';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                window.tempReadingFileBase64 = event.target.result;
                document.getElementById('reading-invoice-file-preview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
    }

    // Form: Maintenance Submit
    document.getElementById('form-maintenance').addEventListener('submit', (e) => {
        e.preventDefault();
        saveMaintenanceEntry();
    });

    // Form: User Submit (Add/Edit)
    document.getElementById('form-user').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('user-id').value;
        const username = document.getElementById('user-username').value.trim();
        const fullname = document.getElementById('user-fullname').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const password = document.getElementById('user-password').value;

        // Validation for unique username (case-insensitive)
        const duplicate = state.users.find(u => u.id !== id && u.username.toLowerCase() === username.toLowerCase());
        if (duplicate) {
            showToast('El nombre de usuario ya está registrado', 'error');
            return;
        }

        // Validation for unique email
        const duplicateEmail = state.users.find(u => u.id !== id && u.email.toLowerCase() === email.toLowerCase());
        if (duplicateEmail) {
            showToast('El email ya está registrado', 'error');
            return;
        }

        // Firebase Auth Creation for new users
        if (firebaseActive && typeof firebase !== 'undefined' && !id) {
            try {
                showToast('Registrando credenciales en la nube...', 'info');
                const savedConfig = localStorage.getItem('firebase_config');
                if (savedConfig) {
                    const config = JSON.parse(savedConfig);
                    let secondaryApp;
                    const existingApp = firebase.apps.find(app => app.name === 'SecondaryApp');
                    if (existingApp) {
                        secondaryApp = existingApp;
                    } else {
                        secondaryApp = firebase.initializeApp(config, 'SecondaryApp');
                    }
                    await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
                    try {
                        await secondaryApp.delete();
                    } catch (delErr) {
                        console.warn("Error deleting secondary app:", delErr);
                    }
                }
            } catch (authErr) {
                console.error("Error creating user in Firebase Auth:", authErr);
                showToast("Error de Firebase Auth: " + authErr.message, "error");
                return;
            }
        }

        const role = document.getElementById('user-role').value;
        const phone = document.getElementById('user-phone').value.trim();

        const userData = { id: id || ('user-' + Date.now()), username, fullname, email, password, role, phone };

        if (id) {
            const idx = state.users.findIndex(u => u.id === id);
            if (idx !== -1) {
                // If the updated user is currently logged in, update the session state too
                if (state.currentUser && state.currentUser.id === id) {
                    if (state.currentUser.username === 'dmoyano' && username !== 'dmoyano') {
                        showToast('No se puede cambiar el nombre de usuario del administrador maestro', 'error');
                        return;
                    }
                    state.currentUser = userData;
                }
                state.users[idx] = userData;
                showToast('Usuario actualizado con éxito', 'success');
            }
        } else {
            state.users.push(userData);
            showToast('Usuario creado con éxito', 'success');
        }

        dbSet('users', userData.id, userData);
        closeAllModals();
        checkAuthSession(); // Updates sidebar profile if we updated ourselves
        renderUsersTab();
    });

    const settleForm = document.getElementById('form-settle-debt');
    if (settleForm) {
        settleForm.addEventListener('submit', submitSettleDebt);
    }
}

// Button action triggers
function setupActions() {
    // Modal closing triggers
    const closeButtons = document.querySelectorAll('.close-modal, .close-modal-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });

    // Open Client Add Modal
    document.getElementById('btn-add-client').addEventListener('click', () => openClientModal());
    document.getElementById('quick-add-client').addEventListener('click', () => {
        openClientModal();
    });

    // Open Machine Add Modal
    document.getElementById('btn-add-machine').addEventListener('click', () => openMachineModal());

    // Open Abono Add Modal
    document.getElementById('btn-add-abono').addEventListener('click', () => openAbonoModal());

    // Quick Add Reading
    document.getElementById('quick-add-reading').addEventListener('click', () => {
        // Go directly to the billing/readings tab
        document.querySelector('.nav-item[data-tab="readings"]').click();
    });

    // Quick Add Rental
    const quickAddRentalBtn = document.getElementById('quick-add-rental');
    if (quickAddRentalBtn) {
        quickAddRentalBtn.addEventListener('click', () => {
            openQuickRentalModal();
        });
    }

    // Quick Rental Cancel actions
    const cancelQuickRentalBtn = document.getElementById('cancel-quick-rental');
    if (cancelQuickRentalBtn) {
        cancelQuickRentalBtn.addEventListener('click', closeAllModals);
    }
    const closeQuickRentalBtn = document.getElementById('close-quick-rental');
    if (closeQuickRentalBtn) {
        closeQuickRentalBtn.addEventListener('click', closeAllModals);
    }

    // Quick Rental Form Submit
    const quickRentalForm = document.getElementById('form-quick-rental');
    if (quickRentalForm) {
        quickRentalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientId = document.getElementById('qr-client-id').value;
            const machineId = document.getElementById('qr-machine-id').value;
            const abonoId = document.getElementById('qr-abono-id').value;
            const initialCounter = parseInt(document.getElementById('qr-initial-counter').value, 10) || 0;
            const applyIva = document.getElementById('qr-apply-iva').checked;
            const readingDay = parseInt(document.getElementById('qr-reading-day').value, 10) || 10;

            const machineIdx = state.machines.findIndex(m => m.id === machineId);
            if (machineIdx !== -1) {
                // Update machine fields
                state.machines[machineIdx].clientId = clientId;
                state.machines[machineIdx].abonoId = abonoId;
                state.machines[machineIdx].initialCounter = initialCounter;
                state.machines[machineIdx].machineCounter = initialCounter;
                state.machines[machineIdx].status = 'Alquilada';
                state.machines[machineIdx].applyIva = applyIva;
                state.machines[machineIdx].readingDay = readingDay;
                state.machines[machineIdx].installationDate = new Date().toISOString().split('T')[0];

                // Sync machine to Firebase
                dbSet('machines', machineId, state.machines[machineIdx]);

                // Create initial reading record for currentMonth
                const existingReading = state.readings.find(r => r.machineId === machineId && r.month === currentMonth);
                if (!existingReading) {
                    const newReading = {
                        id: 'read-' + Date.now(),
                        machineId: machineId,
                        clientId: clientId,
                        abonoId: abonoId || '',
                        month: currentMonth,
                        initial: initialCounter,
                        final: initialCounter,
                        status: 'pending'
                    };
                    state.readings.push(newReading);
                    dbSet('readings', newReading.id, newReading);
                }

                showToast('¡Alquiler activado y máquina asignada con éxito!', 'success');
                closeAllModals();
                renderApp();
            } else {
                showToast('Error: No se encontró la máquina seleccionada', 'error');
            }
        });
    }

    // Sync previous month final readings
    document.getElementById('btn-sync-previous-readings').addEventListener('click', () => {
        syncFinalReadings();
    });

    // Data backups
    document.getElementById('btn-export-data').addEventListener('click', exportDataToJSON);
    document.getElementById('import-file-input').addEventListener('change', importDataFromJSON);
    
    // Accounting Audit Event Listeners
    const btnRunAudit = document.getElementById('btn-run-audit-suite');
    if (btnRunAudit) {
        btnRunAudit.addEventListener('click', runAccountingAuditSuite);
    }
    const btnFixAudit = document.getElementById('btn-fix-audit-balances');
    if (btnFixAudit) {
        btnFixAudit.addEventListener('click', fixAccountingAuditBalances);
    }

    // Danger Zone actions
    document.getElementById('btn-load-demo-data').addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres restablecer todos los datos e importar la demo? Se perderán tus cambios actuales.')) {
            loadDemoData();
            await clearFirestoreCollections();
            await syncStateToFirestore();
            renderApp();
            showToast('Datos de demostración cargados', 'success');
        }
    });

    document.getElementById('btn-clear-all-data').addEventListener('click', async () => {
        if (confirm('ATENCIÓN: Esto eliminará de forma PERMANENTE todos los clientes, abonos, máquinas y lecturas del navegador. ¿Proceder?')) {
            state = { 
                clients: [], 
                machines: [], 
                abonos: [], 
                readings: [], 
                maintenance: [],
                users: state.users,
                currentUser: state.currentUser 
            };
            await clearFirestoreCollections();
            saveToLocalStorage();
            renderApp();
            showToast('Base de datos borrada por completo (los usuarios se conservan)', 'warning');
        }
    });

    // Receipt actions
    document.getElementById('btn-print-receipt').addEventListener('click', () => {
        window.print();
    });

    // Close buttons for maintenance modals
    document.getElementById('close-add-maintenance').onclick = () => {
        document.getElementById('modal-add-maintenance').style.display = 'none';
    };
    document.getElementById('cancel-add-maintenance').onclick = () => {
        document.getElementById('modal-add-maintenance').style.display = 'none';
    };
    document.getElementById('btn-add-maintenance-entry').onclick = () => {
        const machineId = document.getElementById('form-maintenance').querySelector('#maintenance-machine-id').value;
        openAddMaintenanceTrigger(machineId);
    };
    document.getElementById('btn-sync-maintenance-counter').onclick = () => {
        const machineId = document.getElementById('form-maintenance').querySelector('#maintenance-machine-id').value;
        const counter = getLatestCounterForMachine(machineId);
        document.getElementById('maintenance-counter').value = counter;
        showToast('Contador sincronizado con éxito', 'info');
    };

    // Technical Area Actions
    const btnAddTicket = document.getElementById('btn-add-ticket');
    if (btnAddTicket) {
        btnAddTicket.onclick = () => {
            openTicketModal();
        };
    }
    
    document.getElementById('close-modal-ticket').onclick = () => {
        document.getElementById('modal-ticket').style.display = 'none';
    };
    document.getElementById('cancel-modal-ticket').onclick = () => {
        document.getElementById('modal-ticket').style.display = 'none';
    };
    
    document.getElementById('form-ticket').onsubmit = (e) => {
        e.preventDefault();
        saveTicket();
    };

    // Company Logo Upload actions
    const logoInput = document.getElementById('logo-upload-input');
    const removeLogoBtn = document.getElementById('btn-remove-logo');
    
    logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.companyLogo = event.target.result;
                saveToLocalStorage();
                updateLogoPreview();
                showToast('Logotipo guardado con éxito', 'success');
            };
            reader.readAsDataURL(file);
        }
    });

    removeLogoBtn.addEventListener('click', () => {
        if (confirm('¿Seguro que deseas eliminar el logotipo de la empresa?')) {
            delete state.companyLogo;
            saveToLocalStorage();
            updateLogoPreview();
            showToast('Logotipo eliminado', 'info');
        }
    });

    // Reading Reminder Settings Listeners
    const notify7DaysCheckbox = document.getElementById('setting-notify-7days');
    const notify3DaysCheckbox = document.getElementById('setting-notify-3days');
    const notify1DayCheckbox = document.getElementById('setting-notify-1day');
    
    if (notify7DaysCheckbox && notify3DaysCheckbox && notify1DayCheckbox) {
        // Sync checkboxes from state
        notify7DaysCheckbox.checked = state.settings?.reminder7Days !== false;
        notify3DaysCheckbox.checked = state.settings?.reminder3Days !== false;
        notify1DayCheckbox.checked = state.settings?.reminder1Day !== false;

        const saveSettings = () => {
            if (!state.settings) state.settings = {};
            state.settings.reminder7Days = notify7DaysCheckbox.checked;
            state.settings.reminder3Days = notify3DaysCheckbox.checked;
            state.settings.reminder1Day = notify1DayCheckbox.checked;
            saveToLocalStorage();
            renderApp(); // Re-render the notifications panel in real-time!
        };

        notify7DaysCheckbox.addEventListener('change', saveSettings);
        notify3DaysCheckbox.addEventListener('change', saveSettings);
        notify1DayCheckbox.addEventListener('change', saveSettings);
    }

    // Modal tabs toggle logic inside rental detail modal
    const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
    modalTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modalTabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.borderBottomColor = 'transparent';
                b.style.color = 'var(--text-secondary-light)';
            });
            btn.classList.add('active');
            btn.style.borderBottomColor = 'var(--primary)';
            btn.style.color = 'var(--text-primary)';

            const targetTab = btn.getAttribute('data-modal-tab');
            document.querySelectorAll('.modal-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(`modal-tab-${targetTab}`).style.display = 'block';
        });
    });

    // Form: Login
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (firebaseActive && typeof firebase !== 'undefined') {
            const userObj = state.users.find(u => (u.username || '').toLowerCase() === username.toLowerCase() || (u.email || '').toLowerCase() === username.toLowerCase());
            if (!userObj) {
                showToast('Usuario o correo no registrado', 'error');
                return;
            }
            try {
                showToast('Autenticando en la nube...', 'info');
                await firebase.auth().signInWithEmailAndPassword(userObj.email, password);
                state.currentUser = userObj;
                saveToLocalStorage();
                checkAuthSession();
                showToast('¡Bienvenido de nuevo, ' + userObj.fullname + '!', 'success');
                document.getElementById('form-login').reset();
                checkPopNotifications();
            } catch (err) {
                console.warn("Firebase Auth sign-in failed, trying fallback creation:", err);
                
                // Fallback: If password matches the database record, attempt to auto-create the user in Firebase Auth!
                if (userObj.password === password) {
                    try {
                        showToast('Registrando usuario en la nube...', 'info');
                        await firebase.auth().createUserWithEmailAndPassword(userObj.email, password);
                        state.currentUser = userObj;
                        saveToLocalStorage();
                        checkAuthSession();
                        showToast('¡Bienvenido y registrado en la nube, ' + userObj.fullname + '!', 'success');
                        document.getElementById('form-login').reset();
                        checkPopNotifications();
                        return;
                    } catch (createErr) {
                        console.warn("Auto-registration in Auth failed, falling back to local credentials validation:", createErr);
                        // If password is correct according to the database, log them in locally anyway
                        state.currentUser = userObj;
                        saveToLocalStorage();
                        checkAuthSession();
                        showToast('¡Bienvenido, ' + userObj.fullname + '!', 'success');
                        document.getElementById('form-login').reset();
                        checkPopNotifications();
                        return;
                    }
                }
                showToast('Usuario o contraseña incorrectos en Firebase Auth', 'error');
            }
        } else {
            const user = state.users.find(u => (u.username || '').toLowerCase() === username.toLowerCase() || (u.email || '').toLowerCase() === username.toLowerCase());
            if (user && user.password === password) {
                state.currentUser = user;
                saveToLocalStorage();
                checkAuthSession();
                showToast('¡Bienvenido de nuevo, ' + user.fullname + '!', 'success');
                document.getElementById('form-login').reset();
                checkPopNotifications();
            } else {
                showToast('Usuario o contraseña incorrectos', 'error');
            }
        }
    });

    // Logout trigger
    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm('¿Seguro que deseas cerrar la sesión actual?')) {
            if (firebaseActive && typeof firebase !== 'undefined') {
                try {
                    await firebase.auth().signOut();
                } catch (signOutErr) {
                    console.error("Error signing out from Firebase Auth:", signOutErr);
                }
            }
            state.currentUser = null;
            saveToLocalStorage();
            checkAuthSession();
            showToast('Sesión cerrada correctamente', 'info');
        }
    });

    // Links for Login Card toggle
    document.getElementById('link-forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('reset-password-container').style.display = 'flex';
        document.getElementById('recovery-step-1').style.display = 'block';
        document.getElementById('recovery-step-2').style.display = 'none';
        document.getElementById('form-recovery-req').reset();
        document.getElementById('form-recovery-reset').reset();
    });

    const backToLogin = (e) => {
        e.preventDefault();
        document.getElementById('reset-password-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'flex';
    };

    document.getElementById('link-back-login-1').addEventListener('click', backToLogin);
    document.getElementById('link-back-login-2').addEventListener('click', backToLogin);

    // Form: Recovery Step 1
    document.getElementById('form-recovery-req').addEventListener('submit', async (e) => {
        e.preventDefault();
        const identity = document.getElementById('recovery-identity').value.trim().toLowerCase();

        const user = state.users.find(u => u.username.toLowerCase() === identity || u.email.toLowerCase() === identity);
        if (user) {
            recoveryUser = user;
            
            if (firebaseActive && typeof firebase !== 'undefined') {
                try {
                    showToast('Enviando enlace de restablecimiento...', 'info');
                    await firebase.auth().sendPasswordResetEmail(user.email);
                    showToast(`Se ha enviado un correo de restablecimiento a: ${user.email}`, 'success');
                    
                    // Directly return to login since Firebase Auth handles the reset page securely on their servers
                    document.getElementById('reset-password-container').style.display = 'none';
                    document.getElementById('login-container').style.display = 'flex';
                    recoveryUser = null;
                } catch (authErr) {
                    console.error("Error sending reset email:", authErr);
                    showToast("Error de Firebase Auth: " + authErr.message, "error");
                }
            } else {
                // Generate a secure random 6-digit code
                const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
                state.tempRecoveryCode = recoveryCode; // Store code in state temporarily

                // Generate mailto link prefilled with recovery instructions and code
                const subject = encodeURIComponent("Código de Recuperación - M&S Tecnología Digital");
                const body = encodeURIComponent(
                    `Hola ${user.fullname},\n\n` +
                    `Has solicitado restablecer tu contraseña en el Gestor de Alquileres de M&S Tecnología Digital.\n\n` +
                    `Tu código de verificación de seguridad es: ${recoveryCode}\n\n` +
                    `Por favor, ingresa este código en la aplicación para proceder con el restablecimiento.\n\n` +
                    `Si no solicitaste este cambio, por favor ignora este correo.\n\n` +
                    `Atentamente,\n` +
                    `M&S Tecnología Digital`
                );
                const mailtoUrl = `mailto:${user.email}?subject=${subject}&body=${body}`;

                document.getElementById('recovery-email-hint').textContent = `Enviando código a: ${user.email}. Por favor, envía el correo redactado en tu cliente de e-mail para recibir el código.`;
                document.getElementById('recovery-step-1').style.display = 'none';
                document.getElementById('recovery-step-2').style.display = 'block';
                
                // Open user default mail composer pre-filled
                window.location.href = mailtoUrl;

                showToast('Abriendo cliente de e-mail con el código de recuperación pre-completado...', 'info');
            }
        } else {
            showToast('El usuario o email no coincide con ninguna cuenta', 'error');
        }
    });

    // Form: Recovery Step 2
    document.getElementById('form-recovery-reset').addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('recovery-code').value.trim();
        const newPassword = document.getElementById('recovery-new-password').value;
        const confirmPassword = document.getElementById('recovery-new-password-confirm').value;

        if (code !== state.tempRecoveryCode) {
            showToast('Código de verificación inválido.', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('Las contraseñas no coinciden', 'error');
            return;
        }

        if (recoveryUser) {
            const idx = state.users.findIndex(u => u.id === recoveryUser.id);
            if (idx !== -1) {
                state.users[idx].password = newPassword;
                if (state.currentUser && state.currentUser.id === recoveryUser.id) {
                    state.currentUser.password = newPassword;
                }
                // Clear temporary recovery data
                delete state.tempRecoveryCode;
                saveToLocalStorage();
                showToast('Contraseña restablecida con éxito', 'success');
                document.getElementById('reset-password-container').style.display = 'none';
                document.getElementById('login-container').style.display = 'flex';
                recoveryUser = null;
            }
        }
    });

    // Open User Add Modal
    document.getElementById('btn-add-user').addEventListener('click', () => {
        openUserModal();
    });
}

function updateLogoPreview() {
    const previewContainer = document.getElementById('logo-preview-container');
    const placeholder = document.getElementById('logo-preview-placeholder');
    const previewImg = document.getElementById('logo-preview-img');
    const removeBtn = document.getElementById('btn-remove-logo');
    const sidebarLogoImg = document.getElementById('sidebar-logo-img');

    const currentLogo = state.companyLogo || 'logo.png';
    if (sidebarLogoImg) {
        sidebarLogoImg.src = currentLogo;
    }

    if (state.companyLogo) {
        placeholder.style.display = 'none';
        previewImg.src = state.companyLogo;
        previewImg.style.display = 'block';
        removeBtn.style.display = 'inline-block';
    } else {
        placeholder.style.display = 'none';
        previewImg.src = 'logo.png';
        previewImg.style.display = 'block';
        removeBtn.style.display = 'none';
    }
}

// Synchronize Final readings as Initial readings for current month
async function syncFinalReadings() {
    const prevMonthStr = getPreviousMonthString(currentMonth);
    let syncedCount = 0;
    const syncedReadings = [];

    // Filter machines that are currently rented
    const rentedMachines = state.machines.filter(m => m.status === 'Alquilada' && m.clientId);

    rentedMachines.forEach(machine => {
        // Check if there is already a reading for current month
        const hasCurrentReading = state.readings.some(r => r.machineId === machine.id && r.month === currentMonth);
        
        // Find previous reading
        const prevReading = state.readings.find(r => r.machineId === machine.id && r.month === prevMonthStr);
        
        if (prevReading && !hasCurrentReading) {
            // Create a new reading with initial set to previous final
            const newReading = {
                id: 'read-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                machineId: machine.id,
                clientId: machine.clientId || '',
                abonoId: machine.abonoId || '',
                month: currentMonth,
                initial: prevReading.final,
                final: prevReading.final, // set same temporarily
                status: 'pending'
            };
            state.readings.push(newReading);
            syncedReadings.push(newReading);
            syncedCount++;
        }
    });

    if (syncedCount > 0) {
        for (const r of syncedReadings) {
            await dbSet('readings', r.id, r);
        }
        renderApp();
        showToast(`Se crearon ${syncedCount} lecturas trayendo contadores de ${formatPeriod(prevMonthStr)}`, 'success');
    } else {
        showToast(`No hay contadores previos para copiar o todas las máquinas ya tienen lectura en ${formatPeriod(currentMonth)}`, 'info');
    }
}

// Modal open utilities
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

function openQuickRentalModal() {
    closeAllModals();
    const form = document.getElementById('form-quick-rental');
    if (form) form.reset();

    const clientSelect = document.getElementById('qr-client-id');
    const machineSelect = document.getElementById('qr-machine-id');
    const abonoSelect = document.getElementById('qr-abono-id');

    if (clientSelect && machineSelect && abonoSelect) {
        // Populate Clients Select
        clientSelect.innerHTML = '<option value="">-- Selecciona un cliente existente --</option>';
        const sortedClients = [...state.clients].sort((a, b) => a.name.localeCompare(b.name));
        sortedClients.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            clientSelect.appendChild(option);
        });

        // Populate Available Machines Select
        machineSelect.innerHTML = '<option value="">-- Selecciona una máquina disponible --</option>';
        const availableMachines = state.machines.filter(m => m.status === 'Disponible' || !m.clientId);
        availableMachines.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = `${m.brand} ${m.model} (${m.serial}) - ${m.type}`;
            machineSelect.appendChild(option);
        });

        // Populate Abonos Select
        abonoSelect.innerHTML = '<option value="">-- Selecciona un abono --</option>';
        state.abonos.forEach(a => {
            const option = document.createElement('option');
            option.value = a.id;
            option.textContent = `${a.name} (${formatCurrency(a.price)})`;
            abonoSelect.appendChild(option);
        });

        // Prefill counter on machine change
        machineSelect.onchange = (e) => {
            const selectedId = e.target.value;
            const machine = state.machines.find(m => m.id === selectedId);
            const counterInput = document.getElementById('qr-initial-counter');
            if (machine && counterInput) {
                counterInput.value = machine.machineCounter || 0;
            }
        };

        const qrReadingDayInput = document.getElementById('qr-reading-day');
        if (qrReadingDayInput) {
            qrReadingDayInput.value = 10;
        }
    }

    document.getElementById('modal-quick-rental').style.display = 'block';
}

function openClientModal(client = null) {
    closeAllModals();
    const form = document.getElementById('form-client');
    form.reset();
    
    const titleEl = document.getElementById('modal-client-title');
    const idInput = document.getElementById('client-id');
    
    if (client) {
        titleEl.textContent = 'Editar Cliente';
        idInput.value = client.id;
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-phone').value = client.phone;
        document.getElementById('client-email').value = client.email;
        document.getElementById('client-address').value = client.address;
        document.getElementById('client-notes').value = client.notes;
    } else {
        titleEl.textContent = 'Agregar Cliente';
        idInput.value = '';
    }
    
    document.getElementById('modal-client').style.display = 'block';
}

function openMachineModal(machine = null) {
    closeAllModals();
    const form = document.getElementById('form-machine');
    form.reset();
    
    const titleEl = document.getElementById('modal-machine-title');
    const idInput = document.getElementById('machine-id');
    
    // Populate dropdown selects (clients and abonos)
    const clientSelect = document.getElementById('machine-client-id');
    const abonoSelect = document.getElementById('machine-abono-id');
    
    clientSelect.innerHTML = '<option value="">-- Sin Cliente (Disponible) --</option>';
    state.clients.forEach(c => {
        clientSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });

    abonoSelect.innerHTML = '<option value="">-- Sin Abono Asignado --</option>';
    state.abonos.forEach(a => {
        abonoSelect.innerHTML += `<option value="${a.id}">${a.name} (Límite: ${a.limit})</option>`;
    });

    if (machine) {
        titleEl.textContent = 'Editar Máquina';
        idInput.value = machine.id;
        document.getElementById('machine-brand').value = machine.brand || '';
        document.getElementById('machine-model').value = machine.model || '';
        document.getElementById('machine-serial').value = machine.serial || '';
        document.getElementById('machine-type').value = machine.type || 'Multifunción';
        document.getElementById('machine-status').value = machine.status || 'Nuevo';
        document.getElementById('machine-counter').value = machine.machineCounter || 0;
        clientSelect.value = machine.clientId || '';
        abonoSelect.value = machine.abonoId || '';
        document.getElementById('machine-install-date').value = machine.installationDate || '';
        document.getElementById('machine-install-counter').value = machine.initialCounter || 0;
        document.getElementById('machine-apply-iva').checked = machine.applyIva || false;
        document.getElementById('machine-reading-day').value = machine.readingDay || 10;

        const isAvailable = machine.isAvailable !== false;
        const availSelect = document.getElementById('machine-availability');
        availSelect.value = isAvailable ? 'true' : 'false';
        
        const isScrapOrBroken = machine.status === 'Scrap' || machine.status === 'No funciona';
        if (isScrapOrBroken) {
            availSelect.value = 'false';
            availSelect.disabled = true;
        } else {
            availSelect.disabled = false;
        }
    } else {
        titleEl.textContent = 'Agregar Máquina';
        idInput.value = '';
        document.getElementById('machine-brand').value = '';
        document.getElementById('machine-model').value = '';
        document.getElementById('machine-serial').value = '';
        document.getElementById('machine-type').value = 'Multifunción';
        document.getElementById('machine-status').value = 'Nuevo';
        document.getElementById('machine-counter').value = 0;
        clientSelect.value = '';
        abonoSelect.value = '';
        document.getElementById('machine-install-date').value = '';
        document.getElementById('machine-install-counter').value = 0;
        document.getElementById('machine-apply-iva').checked = false;
        document.getElementById('machine-reading-day').value = 10;

        const availSelect = document.getElementById('machine-availability');
        availSelect.value = 'true';
        availSelect.disabled = false;
    }
    
    // Manage fields readability by user role (Technicians view only)
    const userRole = state.currentUser ? (state.currentUser.role || 'administrativo') : 'administrativo';
    const isTech = userRole === 'tecnico';
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.style.display = isTech ? 'none' : 'block';
    }
    const formElements = form.querySelectorAll('input, select, textarea');
    formElements.forEach(el => {
        el.disabled = isTech;
    });

    document.getElementById('modal-machine').style.display = 'block';
}

function openAbonoModal(abono = null) {
    closeAllModals();
    const form = document.getElementById('form-abono');
    form.reset();
    
    const titleEl = document.getElementById('modal-abono-title');
    const idInput = document.getElementById('abono-id');
    
    if (abono) {
        titleEl.textContent = 'Editar Abono';
        idInput.value = abono.id;
        document.getElementById('abono-name').value = abono.name;
        document.getElementById('abono-limit').value = abono.limit;
        document.getElementById('abono-price').value = abono.price;
        document.getElementById('abono-excess-price').value = abono.excessPrice;
        document.getElementById('abono-iva').value = abono.ivaRate !== undefined ? abono.ivaRate : 21;
    } else {
        titleEl.textContent = 'Agregar Abono';
        idInput.value = '';
        document.getElementById('abono-iva').value = 21;
    }
    
    document.getElementById('modal-abono').style.display = 'block';
}

function openReadingModal(machineId, month, reading = null) {
    closeAllModals();
    const form = document.getElementById('form-reading');
    form.reset();

    const machine = state.machines.find(m => m.id === machineId);
    const client = state.clients.find(c => c.id === machine.clientId);
    const abono = state.abonos.find(a => a.id === machine.abonoId);

    if (!machine || !client || !abono) {
        showToast('Error: El equipo debe tener cliente y abono asignado para registrar lecturas', 'error');
        return;
    }

    // Displays
    document.getElementById('reading-display-client').textContent = client.name;
    document.getElementById('reading-display-machine').textContent = `${machine.model} (S/N: ${machine.serial})`;
    document.getElementById('reading-display-abono').textContent = `${abono.name} (${formatCurrency(abono.price)} base + ${formatCurrency(abono.excessPrice)}/copia exc.)`;
    
    document.getElementById('reading-machine-id').value = machineId;
    document.getElementById('reading-month').value = month;

    // Hint for previous month final reading
    const prevMonthStr = getPreviousMonthString(month);
    const prevReading = state.readings.find(r => r.machineId === machineId && r.month === prevMonthStr);
    const hintText = document.getElementById('reading-last-month-hint');
    
    let defaultInitial = machine.initialCounter || machine.machineCounter || 0;
    let hasPrevious = false;
    if (prevReading) {
        defaultInitial = prevReading.final;
        hintText.textContent = `Lectura final de ${formatPeriod(prevMonthStr)}: ${defaultInitial.toLocaleString('es-AR')} (Pre-completado automático)`;
        hasPrevious = true;
    } else {
        hintText.textContent = `Sin lecturas previas. Se inicializa con el contador de instalación: ${defaultInitial.toLocaleString('es-AR')}`;
        if (defaultInitial > 0) {
            hasPrevious = true;
        }
    }

    // Reset file preview indicator
    document.getElementById('reading-invoice-file-preview').style.display = 'none';
    window.tempReadingFileBase64 = '';
    document.getElementById('reading-invoice-file').value = '';

    if (reading) {
        document.getElementById('reading-id').value = reading.id;
        document.getElementById('reading-initial').value = reading.initial;
        document.getElementById('reading-final').value = reading.final;
        document.getElementById('reading-status').value = reading.status;

        document.getElementById('reading-invoice-number').value = reading.invoiceNumber || '';
        document.getElementById('reading-is-unofficial').checked = reading.isUnofficial || false;
        document.getElementById('reading-credit-note').value = reading.creditNote || '';
        document.getElementById('reading-credit-note-reason').value = reading.creditNoteReason || '';
        document.getElementById('reading-debit-note').value = reading.debitNote || '';
        document.getElementById('reading-debit-note-reason').value = reading.debitNoteReason || '';
        
        if (reading.invoiceFile) {
            document.getElementById('reading-invoice-file-preview').style.display = 'block';
        }
    } else {
        document.getElementById('reading-id').value = '';
        document.getElementById('reading-initial').value = defaultInitial;
        document.getElementById('reading-final').value = defaultInitial; // default matching
        document.getElementById('reading-status').value = 'pending';

        document.getElementById('reading-invoice-number').value = '';
        document.getElementById('reading-is-unofficial').checked = false;
        document.getElementById('reading-credit-note').value = '';
        document.getElementById('reading-credit-note-reason').value = '';
        document.getElementById('reading-debit-note').value = '';
        document.getElementById('reading-debit-note-reason').value = '';
    }

    // Lock initial input to prevent altering carry-over integrity
    const initialInput = document.getElementById('reading-initial');
    if (hasPrevious) {
        initialInput.readOnly = true;
        initialInput.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
        initialInput.style.cursor = 'not-allowed';
    } else {
        initialInput.readOnly = false;
        initialInput.style.backgroundColor = '';
        initialInput.style.cursor = '';
    }

    // Trigger calculation updates
    initialInput.dispatchEvent(new Event('input'));

    document.getElementById('modal-reading').style.display = 'block';
}

function openInvoiceModal(reading) {
    closeAllModals();
    
    // Render company logo if uploaded or default exists
    const receiptLogo = document.getElementById('receipt-logo-preview');
    const currentLogo = state.companyLogo || 'logo.png';
    if (currentLogo) {
        receiptLogo.src = currentLogo;
        receiptLogo.style.display = 'block';
    } else {
        receiptLogo.style.display = 'none';
        receiptLogo.src = '';
    }

    const machine = state.machines.find(m => m.id === reading.machineId);
    const client = state.clients.find(c => c.id === machine.clientId);
    const abono = state.abonos.find(a => a.id === machine.abonoId);

    if (!machine || !client || !abono) {
        showToast('Datos de la facturación incompletos', 'error');
        return;
    }

    // Calculate billing details
    const copies = Math.max(0, reading.final - reading.initial);
    const excess = Math.max(0, copies - abono.limit);
    const fixedFee = abono.price;
    const excessFee = excess * abono.excessPrice;
    const netSubtotal = fixedFee + excessFee;
    
    const isUnofficial = reading.isUnofficial || false;
    const ivaRate = (!isUnofficial && machine.applyIva) ? (abono.ivaRate || 0) : 0;
    const ivaCost = netSubtotal * (ivaRate / 100);
    
    const creditNote = reading.creditNote || 0;
    const debitNote = reading.debitNote || 0;
    const totalGeneral = netSubtotal + ivaCost - creditNote + debitNote;

    // Receipt header
    document.getElementById('receipt-period').textContent = formatPeriod(reading.month);
    
    // Date of receipt is today
    const today = new Date();
    document.getElementById('receipt-date').textContent = today.toLocaleDateString('es-AR');

    // Invoice Number and File Download container
    const invNumContainer = document.getElementById('receipt-invoice-number-container');
    const invNumSpan = document.getElementById('receipt-invoice-number');
    if (reading.invoiceNumber) {
        invNumSpan.textContent = reading.invoiceNumber;
        invNumContainer.style.display = 'block';
    } else {
        invNumContainer.style.display = 'none';
    }

    const fileContainer = document.getElementById('receipt-invoice-download-container');
    const fileLink = document.getElementById('receipt-invoice-download');
    if (reading.invoiceFile) {
        fileLink.href = reading.invoiceFile;
        let filename = 'factura_' + reading.month + '.pdf';
        if (reading.invoiceFile.startsWith('data:image/')) {
            const ext = reading.invoiceFile.split(';')[0].split('/')[1] || 'jpg';
            filename = 'factura_' + reading.month + '.' + ext;
        }
        fileLink.setAttribute('download', filename);
        fileContainer.style.display = 'block';
    } else {
        fileContainer.style.display = 'none';
    }

    // Parties
    document.getElementById('receipt-client-name').textContent = client.name;
    document.getElementById('receipt-client-contact').textContent = `Email: ${client.email || 'N/A'} | Tel: ${client.phone || 'N/A'}`;
    document.getElementById('receipt-client-address').textContent = client.address || 'Sin dirección registrada';

    // Machine specifications
    document.getElementById('receipt-machine-model').textContent = `${machine.brand || ''} ${machine.model || ''}`;
    document.getElementById('receipt-machine-serial').textContent = machine.serial;
    document.getElementById('receipt-machine-type').textContent = machine.type;

    // Items Breakdown
    document.getElementById('receipt-plan-desc').textContent = `Incluye hasta ${abono.limit.toLocaleString('es-AR')} copias/impresiones/escaneos`;
    document.getElementById('receipt-fixed-unit-price').textContent = formatCurrency(abono.price);
    document.getElementById('receipt-fixed-subtotal').textContent = formatCurrency(abono.price);

    const excessRow = document.getElementById('receipt-row-excess');
    if (excess > 0) {
        excessRow.style.display = 'table-row';
        document.getElementById('receipt-counter-start').textContent = reading.initial.toLocaleString('es-AR');
        document.getElementById('receipt-counter-end').textContent = reading.final.toLocaleString('es-AR');
        document.getElementById('receipt-total-copies').textContent = copies.toLocaleString('es-AR');
        document.getElementById('receipt-excess-qty').textContent = `${excess.toLocaleString('es-AR')} exc.`;
        document.getElementById('receipt-excess-unit-price').textContent = formatCurrency(abono.excessPrice);
        document.getElementById('receipt-excess-subtotal').textContent = formatCurrency(excessFee);
    } else {
        excessRow.style.display = 'table-row';
        document.getElementById('receipt-counter-start').textContent = reading.initial.toLocaleString('es-AR');
        document.getElementById('receipt-counter-end').textContent = reading.final.toLocaleString('es-AR');
        document.getElementById('receipt-total-copies').textContent = copies.toLocaleString('es-AR');
        document.getElementById('receipt-excess-qty').textContent = `0 exc.`;
        document.getElementById('receipt-excess-unit-price').textContent = formatCurrency(abono.excessPrice);
        document.getElementById('receipt-excess-subtotal').textContent = formatCurrency(0);
    }

    // Totals Block with Credit/Debit Notes
    document.getElementById('receipt-summary-base').textContent = formatCurrency(netSubtotal);
    document.getElementById('receipt-iva-rate-label').textContent = (!isUnofficial && machine.applyIva && ivaRate > 0) ? `${ivaRate}%` : 'No IVA';
    document.getElementById('receipt-summary-iva').textContent = formatCurrency(ivaCost);

    const crRow = document.getElementById('receipt-row-credit-note');
    const dbRow = document.getElementById('receipt-row-debit-note');
    if (creditNote > 0) {
        document.getElementById('receipt-credit-reason-label').textContent = `Nota de Crédito (${reading.creditNoteReason || 'Descuento'}):`;
        document.getElementById('receipt-summary-credit').textContent = `-${formatCurrency(creditNote)}`;
        crRow.style.display = 'flex';
    } else {
        crRow.style.display = 'none';
    }
    if (debitNote > 0) {
        document.getElementById('receipt-debit-reason-label').textContent = `Nota de Débito (${reading.debitNoteReason || 'Recargo'}):`;
        document.getElementById('receipt-summary-debit').textContent = `+${formatCurrency(debitNote)}`;
        dbRow.style.display = 'flex';
    } else {
        dbRow.style.display = 'none';
    }

    document.getElementById('receipt-summary-total').textContent = formatCurrency(totalGeneral);

    // Payment details box
    const payInfoBox = document.getElementById('receipt-payment-info-box');
    const payMethodVal = document.getElementById('receipt-payment-method-val');
    const payRefVal = document.getElementById('receipt-payment-ref-val');
    const payDateVal = document.getElementById('receipt-payment-date-val');
    const bankReconciledVal = document.getElementById('receipt-bank-reconciled-val');
    const reconcileBtn = document.getElementById('btn-reconcile-toggle');
    
    if (reading.paymentMethod || reading.partialPaid > 0 || reading.status === 'paid' || isUnofficial) {
        payInfoBox.style.display = 'block';
        payMethodVal.innerHTML = isUnofficial ? '<span class="badge danger">⚫ No Oficial / Negro</span>' : (reading.paymentMethod || '💵 Efectivo');
        payRefVal.textContent = reading.paymentReference || 'Sin referencia';
        
        let pDate = reading.paymentDate;
        if (pDate) {
            pDate = pDate.split('-').reverse().join('/');
        } else {
            pDate = 'N/A';
        }
        payDateVal.textContent = pDate;
        
        if (isUnofficial) {
            bankReconciledVal.innerHTML = '<span class="badge danger" style="padding: 2px 6px;">Exento (Negro)</span>';
            reconcileBtn.style.display = 'none';
        } else {
            reconcileBtn.style.display = 'inline-block';
            if (reading.bankReconciled) {
                let recDateStr = '';
                if (reading.bankReconciliationDate) {
                    recDateStr = ' (' + reading.bankReconciliationDate.split('-').reverse().join('/') + ')';
                }
                bankReconciledVal.innerHTML = `<span class="badge success" style="font-weight:700; padding: 2px 6px;">🟢 Conciliado${recDateStr}</span>`;
            } else {
                bankReconciledVal.innerHTML = '<span class="badge warning" style="font-weight:700; padding: 2px 6px;">🟡 Pendiente</span>';
            }
        }
        
        reconcileBtn.onclick = async () => {
            const idx = state.readings.findIndex(r => r.id === reading.id);
            if (idx !== -1) {
                const curRec = !state.readings[idx].bankReconciled;
                state.readings[idx].bankReconciled = curRec;
                state.readings[idx].bankReconciliationDate = curRec ? new Date().toISOString().split('T')[0] : '';
                await dbSet('readings', reading.id, state.readings[idx]);
                renderApp();
                showToast(curRec ? 'Factura conciliada con el banco' : 'Factura marcada como pendiente de conciliación', 'info');
                openInvoiceModal(state.readings[idx]);
            }
        };
    } else {
        payInfoBox.style.display = 'none';
    }

    // Status Stamp
    const stamp = document.getElementById('receipt-stamp-status');
    const markPaidBtn = document.getElementById('btn-mark-paid-receipt');
    
    if (reading.status === 'paid') {
        stamp.textContent = 'COBRADO';
        stamp.className = 'receipt-status-stamp paid';
        markPaidBtn.style.display = 'none';
    } else {
        stamp.textContent = 'PENDIENTE';
        stamp.className = 'receipt-status-stamp';
        markPaidBtn.style.display = 'inline-flex';
        
        // Wire mark as paid action
        markPaidBtn.onclick = async () => {
            const idx = state.readings.findIndex(r => r.id === reading.id);
            if (idx !== -1) {
                state.readings[idx].status = 'paid';
                state.readings[idx].paymentMethod = isUnofficial ? 'En Negro (Efectivo)' : 'Efectivo';
                state.readings[idx].paymentDate = new Date().toISOString().split('T')[0];
                state.readings[idx].bankReconciled = !isUnofficial;
                if (!isUnofficial) {
                    state.readings[idx].bankReconciliationDate = new Date().toISOString().split('T')[0];
                }
                await dbSet('readings', reading.id, state.readings[idx]);
                renderApp();
                showToast('Comprobante marcado como cobrado', 'success');
                openInvoiceModal(state.readings[idx]);
            }
        };
    }

    // Wire share via WhatsApp action
    const whatsappBtn = document.getElementById('btn-share-whatsapp');
    if (whatsappBtn) {
        whatsappBtn.onclick = () => {
            const clientPhone = (client.phone || '').trim().replace(/[^0-9]/g, '');
            const periodStr = formatPeriod(reading.month);
            const machineName = `${machine.brand || ''} ${machine.model}`.trim();
            const excessStr = excess > 0 
                ? `\n*Copias Excedentes:* ${excess.toLocaleString('es-AR')} (${formatCurrency(abono.excessPrice)}/copia) -> *Subtotal exc:* ${formatCurrency(excessFee)}`
                : '';
            const ivaStr = (!isUnofficial && machine.applyIva && ivaRate > 0)
                ? `\n*Subtotal Neto:* ${formatCurrency(netSubtotal)}\n*IVA (${ivaRate}%):* ${formatCurrency(ivaCost)}`
                : '';
            const adjustStr = (creditNote > 0 ? `\n*Nota de Crédito:* -${formatCurrency(creditNote)} (${reading.creditNoteReason || 'Descuento'})` : '') +
                              (debitNote > 0 ? `\n*Nota de Débito:* +${formatCurrency(debitNote)} (${reading.debitNoteReason || 'Recargo'})` : '');

            const msg = `Estimado *${client.name}*,\nLe compartimos el resumen de cobro de alquiler para el período *${periodStr}*:\n\n` +
                (reading.invoiceNumber ? `*Factura Nro:* ${reading.invoiceNumber}\n` : '') +
                `*Equipo:* ${machineName} (S/N: ${machine.serial})\n` +
                `*Lectura Inicial:* ${reading.initial.toLocaleString('es-AR')}\n` +
                `*Lectura Final:* ${reading.final.toLocaleString('es-AR')}\n` +
                `*Consumo del Mes:* ${copies.toLocaleString('es-AR')} copias\n\n` +
                `*Abono Fijo:* ${formatCurrency(abono.price)} (Incluye ${abono.limit.toLocaleString('es-AR')} copias)${excessStr}${ivaStr}${adjustStr}\n` +
                `-----------------------------------------\n` +
                `*TOTAL A ABONAR:* ${formatCurrency(totalGeneral)}\n\n` +
                `Por favor, envíe el comprobante de transferencia bancaria una vez realizado el pago. ¡Muchas gracias por su confianza!\n_M&S Tecnología Digital_`;

            const encodedMsg = encodeURIComponent(msg);
            let waUrl = `https://wa.me/?text=${encodedMsg}`;
            if (clientPhone) {
                waUrl = `https://wa.me/${clientPhone}?text=${encodedMsg}`;
            }
            window.open(waUrl, '_blank');
        };
    }

    document.getElementById('modal-invoice-detail').style.display = 'block';
}


// Tab View 1: Dashboard
function renderDashboardNotifications() {
    const listEl = document.getElementById('dashboard-notifications-list');
    const rowEl = document.getElementById('dashboard-notifications-row');
    if (!listEl || !rowEl) return;

    listEl.innerHTML = '';
    
    // Normalize today's date
    const today = new Date();
    const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const activeRentals = state.machines.filter(m => m.clientId);
    const alerts = [];

    activeRentals.forEach(machine => {
        // Check if a reading has already been logged for the current active month (currentMonth)
        const reading = state.readings.find(r => r.machineId === machine.id && r.month === currentMonth);
        if (reading) return; // Already logged, skip alert

        const client = state.clients.find(c => c.id === machine.clientId);
        if (!client) return;

        const readingDay = machine.readingDay || 10;
        
        // Calculate deadline in the current month
        const deadline = new Date(today.getFullYear(), today.getMonth(), readingDay);
        
        // Calculate difference in days
        const diffTime = deadline - todayNormalized;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let shouldShow = false;
        let alertText = '';
        let badgeType = ''; // 'danger' or 'warning'

        if (diffDays < 0) {
            // Overdue! Always show overdue readings
            shouldShow = true;
            alertText = `Debió registrarse hace ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'día' : 'días'} (Día ${readingDay} de cada mes).`;
            badgeType = 'danger';
        } else if (diffDays === 0) {
            // Due today
            shouldShow = true;
            alertText = `Hoy corresponde tomar la lectura mensual de este equipo (Día ${readingDay} de cada mes).`;
            badgeType = 'danger';
        } else {
            // Upcoming days. Check matching reminder preferences.
            const reminder7 = state.settings?.reminder7Days !== false;
            const reminder3 = state.settings?.reminder3Days !== false;
            const reminder1 = state.settings?.reminder1Day !== false;

            if (diffDays === 7 && reminder7) {
                shouldShow = true;
                alertText = `Falta exactamente 1 semana (7 días) para tomar la lectura (Día ${readingDay}).`;
                badgeType = 'warning';
            } else if (diffDays <= 3 && diffDays > 1 && reminder3) {
                shouldShow = true;
                alertText = `Faltan ${diffDays} días para tomar la lectura (Día ${readingDay}).`;
                badgeType = 'warning';
            } else if (diffDays === 1 && reminder1) {
                shouldShow = true;
                alertText = `Falta 1 día para tomar la lectura (Día ${readingDay}).`;
                badgeType = 'warning';
            }
        }

        if (shouldShow) {
            alerts.push({
                machine,
                client,
                text: alertText,
                badgeType,
                diffDays
            });
        }
    });

    // Sort alerts: most overdue first, then closest upcoming
    alerts.sort((a, b) => a.diffDays - b.diffDays);

    if (alerts.length > 0) {
        rowEl.style.display = 'block';
        alerts.forEach(alert => {
            const li = document.createElement('li');
            li.style.padding = '10px 14px';
            li.style.borderRadius = '8px';
            li.style.fontSize = '13px';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.gap = '12px';
            
            let bg = 'rgba(245, 158, 11, 0.08)';
            let border = '1px solid rgba(245, 158, 11, 0.15)';
            let color = '#d97706';
            let badgeText = 'Próximo';
            let badgeStyle = 'background-color: var(--amber-light); color: var(--amber);';

            if (alert.badgeType === 'danger') {
                bg = 'rgba(239, 68, 68, 0.08)';
                border = '1px solid rgba(239, 68, 68, 0.15)';
                color = '#dc2626';
                badgeText = alert.diffDays < 0 ? 'Atrasado' : 'Hoy';
                badgeStyle = 'background-color: var(--danger-light); color: var(--danger);';
            }

            li.style.backgroundColor = bg;
            li.style.border = border;
            li.style.color = color;

            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge" style="font-weight:700; font-size:10px; text-transform:uppercase; padding:2px 6px; ${badgeStyle}">${badgeText}</span>
                    <span><strong>${alert.client.name}</strong> (${alert.machine.brand || ''} ${alert.machine.model} - S/N: ${alert.machine.serial}): ${alert.text}</span>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="addReadingTrigger('${alert.machine.id}')" style="background-color:white; border:1px solid rgba(0,0,0,0.1); color:var(--text-primary); font-size:11px; padding:4px 10px; white-space:nowrap; flex-shrink:0;">
                    Tomar Lectura
                </button>
            `;
            listEl.appendChild(li);
        });
    } else {
        rowEl.style.display = 'none';
    }
}

function renderDashboardTab() {
    // 1. Calculate General Metrics
    renderDashboardNotifications();
    renderDashboardTechnicalTickets();
    const activeClientsCount = state.clients.length;
    const rentedMachines = state.machines.filter(m => m.clientId);
    const rentedMachinesCount = rentedMachines.length;

    // Monthly Projected base (Fixed fees from active rented machines including default IVA if applicable)
    let projectedBase = 0;
    rentedMachines.forEach(m => {
        const abono = state.abonos.find(a => a.id === m.abonoId);
        if (abono) {
            const baseFixed = abono.price;
            const ivaRate = m.applyIva ? (abono.ivaRate || 0) : 0;
            projectedBase += baseFixed * (1 + ivaRate / 100);
        }
    });

    // Real billing calculation for selected currentMonth
    let totalInvoiced = 0;
    let excessInvoiced = 0;
    let paidAmt = 0;
    let pendingAmt = 0;
    
    let loggedReadingsCount = 0;

    rentedMachines.forEach(machine => {
        const reading = state.readings.find(r => r.machineId === machine.id && r.month === currentMonth);
        const abono = state.abonos.find(a => a.id === machine.abonoId);
        
        if (abono) {
            const ivaRate = machine.applyIva ? (abono.ivaRate || 0) : 0;
            if (reading) {
                loggedReadingsCount++;
                const copies = Math.max(0, reading.final - reading.initial);
                const excess = Math.max(0, copies - abono.limit);
                const fixedCost = abono.price;
                const excessCost = excess * abono.excessPrice;
                
                const isUnofficial = reading.isUnofficial || false;
                const creditNote = reading.creditNote || 0;
                const debitNote = reading.debitNote || 0;

                const netCost = fixedCost + excessCost;
                const calculatedIvaRate = (!isUnofficial && machine.applyIva) ? (abono.ivaRate || 0) : 0;
                const ivaCost = netCost * (calculatedIvaRate / 100);
                const totalCost = netCost + ivaCost - creditNote + debitNote;

                totalInvoiced += totalCost;
                excessInvoiced += excessCost * (1 + calculatedIvaRate / 100);

                const alreadyPaid = reading.partialPaid || 0;
                if (reading.status === 'paid') {
                    paidAmt += totalCost;
                } else {
                    paidAmt += alreadyPaid;
                    pendingAmt += Math.max(0, totalCost - alreadyPaid);
                }
            } else {
                // If no reading loaded, we project the fixed fee with IVA as pending
                const baseFee = abono.price;
                const ivaFee = baseFee * (ivaRate / 100);
                const totalCost = baseFee + ivaFee;
                totalInvoiced += totalCost;
                pendingAmt += totalCost;
            }
        }
    });

    // Update numbers depending on role
    const userRole = state.currentUser ? (state.currentUser.role || 'administrativo') : 'administrativo';
    const isTech = userRole === 'tecnico';

    document.getElementById('stat-active-clients').textContent = activeClientsCount;
    document.getElementById('stat-rented-machines').textContent = rentedMachinesCount;

    const card3Title = document.querySelector('.metric-card:nth-child(3) h3');
    const card3Value = document.getElementById('stat-fixed-revenue');
    const card3Sub = document.querySelector('.metric-card:nth-child(3) .metric-subtext');
    const card3Icon = document.querySelector('.metric-card:nth-child(3) .metric-icon');

    const card4Title = document.querySelector('.metric-card:nth-child(4) h3');
    const card4Value = document.getElementById('stat-total-revenue');
    const card4Sub = document.getElementById('stat-excedente-revenue');
    const card4Icon = document.querySelector('.metric-card:nth-child(4) .metric-icon');

    if (isTech) {
        // Morph Card 3 to Technical Pending incident tickets count
        if (card3Title) card3Title.textContent = 'Pedidos Pendientes';
        if (card3Value) {
            const pendingCount = (state.tickets || []).filter(t => t.status !== 'visto-resuelto' && t.status !== 'sin-solucion').length;
            card3Value.textContent = pendingCount;
            card3Value.className = 'metric-value text-indigo';
        }
        if (card3Sub) card3Sub.textContent = 'Servicios sin finalizar';
        if (card3Icon) {
            card3Icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
            card3Icon.className = 'metric-icon bg-indigo-light text-indigo';
        }

        // Morph Card 4 to Technical urgent incident tickets count
        if (card4Title) card4Title.textContent = 'Pedidos Críticos';
        if (card4Value) {
            const urgentCount = (state.tickets || []).filter(t => t.priority === 'alta' && t.status !== 'visto-resuelto' && t.status !== 'sin-solucion').length;
            card4Value.textContent = urgentCount;
            card4Value.className = 'metric-value text-danger';
        }
        if (card4Sub) {
            card4Sub.textContent = 'Atención inmediata requerida';
            card4Sub.className = 'metric-subtext text-danger';
        }
        if (card4Icon) {
            card4Icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>`;
            card4Icon.className = 'metric-icon bg-danger-light text-danger';
        }

        // Morph dashboard left card to Active Technical Tickets list
        const leftProg = document.querySelector('#dashboard-left-card .progress-container');
        if (leftProg) leftProg.style.display = 'none';
        
        const leftTitle = document.getElementById('dashboard-left-card-title');
        if (leftTitle) leftTitle.textContent = 'Pedidos Activos del Área Técnica';

        const tableHead = document.querySelector('#dashboard-pending-readings-table thead');
        if (tableHead) {
            tableHead.innerHTML = `
                <tr>
                    <th>Fecha/Hora</th>
                    <th>Cliente</th>
                    <th>Equipo</th>
                    <th>Problema / Tarea</th>
                    <th>Prioridad</th>
                    <th>Acción</th>
                </tr>
            `;
        }

        // Morph dashboard right card to My Assigned Support requests
        const rightTitle = document.getElementById('dashboard-right-card-title');
        if (rightTitle) rightTitle.textContent = 'Mis Pedidos Asignados';

        const rightBilling = document.querySelector('#dashboard-right-card .billing-summary-block');
        if (rightBilling) rightBilling.style.display = 'none';

        let myTicketsList = document.getElementById('dashboard-my-tickets-list');
        if (!myTicketsList) {
            myTicketsList = document.createElement('div');
            myTicketsList.id = 'dashboard-my-tickets-list';
            myTicketsList.style.maxHeight = '320px';
            myTicketsList.style.overflowY = 'auto';
            document.querySelector('#dashboard-right-card .card-body').appendChild(myTicketsList);
        }
        myTicketsList.style.display = 'block';
        myTicketsList.innerHTML = '';

        const myAssigned = (state.tickets || []).filter(t => t.assignedTechId === state.currentUser.id && t.status !== 'visto-resuelto' && t.status !== 'sin-solucion');
        if (myAssigned.length === 0) {
            myTicketsList.innerHTML = `<p class="text-xs text-secondary-light text-center py-4">No tienes pedidos de soporte asignados pendientes.</p>`;
        } else {
            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.padding = '0';
            ul.style.margin = '0';
            ul.style.display = 'flex';
            ul.style.flexDirection = 'column';
            ul.style.gap = '8px';
            
            myAssigned.forEach(t => {
                const li = document.createElement('li');
                li.style.padding = '10px';
                li.style.borderRadius = '6px';
                li.style.backgroundColor = 'rgba(99,102,241,0.05)';
                li.style.border = '1px solid rgba(99,102,241,0.1)';
                li.style.fontSize = '12px';
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                
                let pBadge = '';
                if (t.priority === 'alta') pBadge = '🔴';
                else if (t.priority === 'media') pBadge = '🟡';
                else pBadge = '🟢';
                
                li.innerHTML = `
                    <div style="line-height:1.3; color:var(--text-primary);">
                        <strong>${pBadge} ${t.clientName}</strong>
                        <span class="d-block text-xs text-secondary-light mt-0.5" style="font-weight:500;">${t.machineDesc}</span>
                        <span class="d-block text-xs mt-1 text-secondary-light" style="font-weight:400; line-height:1.2; font-style:italic;">"${escapeHTML(t.description)}"</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="editTicketTrigger('${t.id}')" style="background-color:white; font-size:10px; padding:4px 8px; margin-left:8px; flex-shrink:0;">
                        Atender
                    </button>
                `;
                ul.appendChild(li);
            });
            myTicketsList.appendChild(ul);
        }

        // Render Active incident requests list into Left Table
        const dashboardTableBody = document.querySelector('#dashboard-pending-readings-table tbody');
        dashboardTableBody.innerHTML = '';
        const activeTickets = (state.tickets || []).filter(t => t.status !== 'visto-resuelto' && t.status !== 'sin-solucion');
        const priorityWeight = { alta: 3, media: 2, baja: 1 };
        activeTickets.sort((a, b) => {
            const prioDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
            if (prioDiff !== 0) return prioDiff;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });

        if (activeTickets.length === 0) {
            dashboardTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-secondary-light">No hay pedidos técnicos activos en este momento.</td></tr>`;
        } else {
            activeTickets.forEach(ticket => {
                const dateFmt = ticket.date ? ticket.date.split('-').reverse().join('/') : 'N/A';
                
                let priorityBadge = '';
                if (ticket.priority === 'alta') {
                    priorityBadge = `<span class="badge danger" style="font-weight:700;">🔴 Alta</span>`;
                } else if (ticket.priority === 'media') {
                    priorityBadge = `<span class="badge warning" style="font-weight:700; color:#d97706; background-color:rgba(245,158,11,0.12);">🟡 Media</span>`;
                } else {
                    priorityBadge = `<span class="badge success" style="font-weight:700;">🟢 Baja</span>`;
                }

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${dateFmt}</strong> <span class="text-xs text-secondary-light d-block">${ticket.time || ''}</span></td>
                    <td class="font-bold-title">${ticket.clientName}</td>
                    <td>${ticket.machineDesc}</td>
                    <td><strong>${ticket.taskType}</strong> <span class="text-xs text-secondary-light d-block">${escapeHTML(ticket.description)}</span></td>
                    <td>${priorityBadge}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="editTicketTrigger('${ticket.id}')">Atender</button>
                    </td>
                `;
                dashboardTableBody.appendChild(row);
            });
        }
    } else {
        // Reset left/right morphing back to administrative view
        const leftProg = document.querySelector('#dashboard-left-card .progress-container');
        if (leftProg) leftProg.style.display = 'block';
        
        const leftTitle = document.getElementById('dashboard-left-card-title');
        if (leftTitle) leftTitle.textContent = 'Estado de Lecturas del Mes Seleccionado';

        const tableHead = document.querySelector('#dashboard-pending-readings-table thead');
        if (tableHead) {
            tableHead.innerHTML = `
                <tr>
                    <th>Cliente</th>
                    <th>Máquina</th>
                    <th>Abono</th>
                    <th>Estado Lectura</th>
                    <th>Acción</th>
                </tr>
            `;
        }

        const rightTitle = document.getElementById('dashboard-right-card-title');
        if (rightTitle) rightTitle.textContent = 'Resumen de Cobros';

        const rightBilling = document.querySelector('#dashboard-right-card .billing-summary-block');
        if (rightBilling) rightBilling.style.display = 'block';

        const myTicketsList = document.getElementById('dashboard-my-tickets-list');
        if (myTicketsList) myTicketsList.style.display = 'none';

        // Original administrator metrics population
        if (card3Title) card3Title.textContent = 'Abono Mensual Fijo';
        if (card3Value) {
            card3Value.textContent = formatCurrency(projectedBase);
            card3Value.className = 'metric-value';
        }
        if (card3Sub) card3Sub.textContent = 'Total proyectado base';
        if (card3Icon) {
            card3Icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
            card3Icon.className = 'metric-icon bg-blue-light text-blue';
        }

        if (card4Title) card4Title.textContent = 'Facturación Total Mes';
        if (card4Value) {
            card4Value.textContent = formatCurrency(totalInvoiced);
            card4Value.className = 'metric-value';
        }
        if (card4Sub) {
            card4Sub.textContent = `Excedentes: ${formatCurrency(excessInvoiced)}`;
            card4Sub.className = 'metric-subtext';
        }
        if (card4Icon) {
            card4Icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path><polyline points="18 8 22 12 18 16"></polyline></svg>`;
            card4Icon.className = 'metric-icon bg-purple-light text-purple';
        }

        // Billing chart summary
        document.getElementById('billing-summary-paid').textContent = formatCurrency(paidAmt);
        document.getElementById('billing-summary-pending').textContent = formatCurrency(pendingAmt);

        const billingTotal = paidAmt + pendingAmt;
        const paidPct = billingTotal > 0 ? Math.round((paidAmt / billingTotal) * 100) : 0;
        const pendingPct = billingTotal > 0 ? (100 - paidPct) : 0;

        document.getElementById('chart-bar-paid').style.width = `${paidPct}%`;
        document.getElementById('chart-bar-pending').style.width = `${pendingPct}%`;
        document.getElementById('chart-pct-paid').textContent = `${paidPct}%`;
        document.getElementById('chart-pct-pending').textContent = `${pendingPct}%`;

        // readings progress
        const totalToRead = rentedMachinesCount;
        const progressPct = totalToRead > 0 ? Math.round((loggedReadingsCount / totalToRead) * 100) : 0;
        document.getElementById('dashboard-month-label').textContent = formatPeriod(currentMonth);
        document.getElementById('readings-progress-percent').textContent = `${progressPct}%`;
        document.getElementById('readings-progress-bar').style.width = `${progressPct}%`;
        document.getElementById('readings-progress-desc').textContent = `${loggedReadingsCount} de ${totalToRead} máquinas registradas en el mes`;

        // Render readings table
        const dashboardTableBody = document.querySelector('#dashboard-pending-readings-table tbody');
        dashboardTableBody.innerHTML = '';
        if (rentedMachines.length === 0) {
            dashboardTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No hay máquinas alquiladas registradas. Ve a Máquinas para asignar.</td></tr>`;
        } else {
            rentedMachines.forEach(machine => {
                const client = state.clients.find(c => c.id === machine.clientId);
                const abono = state.abonos.find(a => a.id === machine.abonoId);
                const reading = state.readings.find(r => r.machineId === machine.id && r.month === currentMonth);

                const clientName = client ? client.name : 'Cliente no encontrado';
                const abonoName = abono ? abono.name : 'Sin plan';

                let statusBadge = '';
                let actionBtn = '';

                if (reading) {
                    if (reading.status === 'paid') {
                        statusBadge = `<span class="badge success">Lectura Cargada (Cobrado)</span>`;
                    } else {
                        statusBadge = `<span class="badge warning">Lectura Cargada (Pendiente)</span>`;
                    }
                    actionBtn = `<button class="btn btn-secondary btn-sm" onclick="editReadingTrigger('${reading.id}')">Editar Lectura</button>`;
                } else {
                    statusBadge = `<span class="badge danger">Falta Lectura</span>`;
                    actionBtn = `<button class="btn btn-primary btn-sm btn-icon" onclick="addReadingTrigger('${machine.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M12 5v14M5 12h14"/></svg>
                        Cargar Lectura
                    </button>`;
                }

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="font-bold-title">${clientName}</td>
                    <td>${machine.model} <span class="text-xs text-secondary-light">(${machine.serial})</span></td>
                    <td>${abonoName}</td>
                    <td>${statusBadge}</td>
                    <td>${actionBtn}</td>
                `;
                dashboardTableBody.appendChild(row);
            });
        }
    }

    // 4. Recent Maintenance Service Log
    const recentMaintenanceBody = document.querySelector('#dashboard-recent-maintenance-table tbody');
    if (recentMaintenanceBody) {
        recentMaintenanceBody.innerHTML = '';
        const sortedMaint = [...state.maintenance].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
        
        if (sortedMaint.length === 0) {
            recentMaintenanceBody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-secondary-light">No hay registros de servicio recientes.</td></tr>`;
        } else {
            sortedMaint.forEach(entry => {
                const machine = state.machines.find(m => m.id === entry.machineId);
                const machineLabel = machine ? `${machine.model} (${machine.serial})` : 'Desconocido';
                const dateFmt = entry.date ? entry.date.split('-').reverse().join('/') : 'N/A';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${dateFmt}</strong></td>
                    <td>${machineLabel}</td>
                    <td><span class="badge" style="font-size: 10px;">${entry.type}</span></td>
                    <td class="font-bold-title">${entry.description}</td>
                `;
                recentMaintenanceBody.appendChild(row);
            });
        }
    }

    // 5. Machine Inventory Distribution Counts
    const totalAvailable = state.machines.filter(m => m.status === 'Disponible' || !m.clientId).length;
    const colorRented = state.machines.filter(m => m.clientId && m.type === 'Color').length;
    const monoRented = state.machines.filter(m => m.clientId && m.type !== 'Color').length;

    const availableEl = document.getElementById('stat-machines-available');
    const colorEl = document.getElementById('stat-machines-color');
    const monoEl = document.getElementById('stat-machines-mono');

    if (availableEl) availableEl.textContent = totalAvailable;
    if (colorEl) colorEl.textContent = colorRented;
    if (monoEl) monoEl.textContent = monoRented;

    // Render visual analytics charts
    setTimeout(renderDashboardCharts, 100);
}

function renderDashboardCharts() {
    if (typeof Chart === 'undefined') return;

    if (chartEarningsInstance) {
        chartEarningsInstance.destroy();
        chartEarningsInstance = null;
    }
    if (chartMachinesInstance) {
        chartMachinesInstance.destroy();
        chartMachinesInstance = null;
    }

    const ctxEarnings = document.getElementById('chart-earnings-history');
    const ctxMachines = document.getElementById('chart-machines-distribution');
    if (!ctxEarnings || !ctxMachines) return;

    // Helper to calculate recent 6 periods YYYY-MM
    const getRecent6Months = (endPeriod) => {
        const periods = [];
        let [year, month] = endPeriod.split('-').map(Number);
        
        for (let i = 0; i < 6; i++) {
            periods.unshift(`${year}-${String(month).padStart(2, '0')}`);
            month--;
            if (month === 0) {
                month = 12;
                year--;
            }
        }
        return periods;
    };

    const recentPeriods = getRecent6Months(currentMonth);
    const userRole = state.currentUser ? (state.currentUser.role || 'administrativo') : 'administrativo';
    const isTech = userRole === 'tecnico';

    let chartData = [];
    let chartLabelText = 'Ingresos ($)';
    let tooltipLabelCallback = function(context) {
        return 'Ingresos: ' + formatCurrency(context.parsed.y);
    };
    let yAxisTickCallback = function(value) {
        return '$' + value.toLocaleString('es-AR');
    };

    const chartTitleEl = document.getElementById('chart-earnings-card-title');
    if (isTech) {
        if (chartTitleEl) chartTitleEl.textContent = 'Servicios Técnicos Realizados (Últimos 6 Meses)';
        chartLabelText = 'Servicios Realizados';
        chartData = recentPeriods.map(period => {
            return (state.maintenance || []).filter(m => m.date && m.date.startsWith(period)).length;
        });
        tooltipLabelCallback = function(context) {
            return 'Servicios: ' + context.parsed.y;
        };
        yAxisTickCallback = function(value) {
            return value + ' serv.';
        };
    } else {
        if (chartTitleEl) chartTitleEl.textContent = 'Historial de Ingresos de Alquiler ($ ARS)';
        chartData = recentPeriods.map(period => {
            let revenue = 0;
            state.machines.forEach(machine => {
                const reading = state.readings.find(r => r.machineId === machine.id && r.month === period);
                const abono = state.abonos.find(a => a.id === machine.abonoId);
                if (abono) {
                    const ivaRate = machine.applyIva ? (abono.ivaRate || 0) : 0;
                    if (reading) {
                        const copies = Math.max(0, reading.final - reading.initial);
                        const excess = Math.max(0, copies - abono.limit);
                        const netCost = abono.price + (excess * abono.excessPrice);
                        revenue += netCost * (1 + ivaRate / 100);
                    } else if (machine.clientId) {
                        revenue += abono.price * (1 + ivaRate / 100);
                    }
                }
            });
            return Math.round(revenue);
        });
    }

    const formattedLabels = recentPeriods.map(p => formatPeriod(p).split(' ')[0]);

    // 1. Bar Chart: Earnings History (or Services completed for tech)
    chartEarningsInstance = new Chart(ctxEarnings, {
        type: 'bar',
        data: {
            labels: formattedLabels,
            datasets: [{
                label: chartLabelText,
                data: chartData,
                backgroundColor: isTech ? 'rgba(16, 185, 129, 0.75)' : 'rgba(99, 102, 241, 0.75)',
                borderColor: isTech ? 'rgba(16, 185, 129, 1)' : 'rgba(99, 102, 241, 1)',
                borderWidth: 1.5,
                borderRadius: 6,
                hoverBackgroundColor: isTech ? 'rgba(16, 185, 129, 0.95)' : 'rgba(99, 102, 241, 0.95)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: tooltipLabelCallback
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: {
                        callback: yAxisTickCallback,
                        font: { size: 9 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9 } }
                }
            }
        }
    });

    // 2. Doughnut Chart: Machines Distribution
    const rentedCount = state.machines.filter(m => m.clientId).length;
    const availableCount = state.machines.filter(m => !m.clientId).length;

    chartMachinesInstance = new Chart(ctxMachines, {
        type: 'doughnut',
        data: {
            labels: ['Alquiladas', 'Disponibles'],
            datasets: [{
                data: [rentedCount, availableCount],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.85)',
                    'rgba(16, 185, 129, 0.85)'
                ],
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        font: { size: 10, family: 'Outfit, sans-serif' },
                        padding: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = rentedCount + availableCount;
                            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                            return ` ${context.label}: ${value} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Window globally scoped triggers so they can be triggered from HTML attributes (onclick)
window.addReadingTrigger = (machineId) => {
    openReadingModal(machineId, currentMonth);
};

window.editReadingTrigger = (readingId) => {
    const reading = state.readings.find(r => r.id === readingId);
    if (reading) {
        openReadingModal(reading.machineId, reading.month, reading);
    }
};

window.viewInvoiceTrigger = (readingId) => {
    const reading = state.readings.find(r => r.id === readingId);
    if (reading) {
        openInvoiceModal(reading);
    }
};

window.editClientTrigger = (clientId) => {
    const client = state.clients.find(c => c.id === clientId);
    if (client) openClientModal(client);
};

window.deleteClientTrigger = (clientId) => {
    // Check if user is administrator
    if (state.currentUser?.role === 'tecnico') {
        showToast('Acceso denegado: El rol Técnico no tiene permisos para eliminar clientes', 'error');
        return;
    }

    // Check if the client has any reading history or outstanding debts
    const clientReadings = state.readings.filter(r => r.clientId === clientId);
    if (clientReadings.length > 0) {
        const pendingReadings = clientReadings.filter(r => r.status === 'pending');
        if (pendingReadings.length > 0) {
            showToast('No se puede eliminar el cliente porque posee deudas pendientes de pago', 'error');
        } else {
            showToast('No se puede eliminar este cliente porque cuenta con un historial de facturación que debe conservarse', 'error');
        }
        return;
    }

    if (confirm('¿Seguro que deseas eliminar este cliente? No se desasignarán las máquinas de forma automática pero dejará huérfanas sus referencias.')) {
        state.clients = state.clients.filter(c => c.id !== clientId);
        dbDelete('clients', clientId);
        renderApp();
        showToast('Cliente eliminado', 'warning');
    }
};

window.editMachineTrigger = (machineId) => {
    const machine = state.machines.find(m => m.id === machineId);
    if (machine) openMachineModal(machine);
};

window.deleteMachineTrigger = (machineId) => {
    // Check if user is administrator
    if (state.currentUser?.role === 'tecnico') {
        showToast('Acceso denegado: El rol Técnico no tiene permisos para eliminar máquinas', 'error');
        return;
    }

    // Check if the machine has any reading history or outstanding debts
    const machineReadings = state.readings.filter(r => r.machineId === machineId);
    if (machineReadings.length > 0) {
        const pendingReadings = machineReadings.filter(r => r.machineId === machineId && r.status === 'pending');
        if (pendingReadings.length > 0) {
            showToast('No se puede eliminar esta máquina porque tiene deudas/lecturas pendientes asociadas', 'error');
        } else {
            showToast('No se puede eliminar esta máquina porque cuenta con un historial de lecturas que debe conservarse', 'error');
        }
        return;
    }

    if (confirm('¿Seguro que deseas eliminar esta máquina?')) {
        state.machines = state.machines.filter(m => m.id !== machineId);
        dbDelete('machines', machineId);
        renderApp();
        showToast('Máquina eliminada', 'warning');
    }
};

window.editAbonoTrigger = (abonoId) => {
    const abono = state.abonos.find(a => a.id === abonoId);
    if (abono) openAbonoModal(abono);
};

window.deleteAbonoTrigger = (abonoId) => {
    // Check if being used
    const inUse = state.machines.some(m => m.abonoId === abonoId);
    if (inUse) {
        showToast('No se puede eliminar el abono porque está asignado a una o más máquinas activas', 'error');
        return;
    }
    if (confirm('¿Seguro que deseas eliminar este abono?')) {
        state.abonos = state.abonos.filter(a => a.id !== abonoId);
        dbDelete('abonos', abonoId);
        renderApp();
        showToast('Abono eliminado', 'warning');
    }
};

// Tab View 2: Readings & Invoices
function renderReadingsTab() {
    const tableBody = document.querySelector('#readings-table tbody');
    tableBody.innerHTML = '';

    const filterStatus = document.getElementById('filter-reading-status').value;
    const searchClientVal = document.getElementById('search-reading-client').value.toLowerCase();

    // Active rented machines
    const rentedMachines = state.machines.filter(m => m.clientId);

    let filteredMachines = rentedMachines.filter(machine => {
        const client = state.clients.find(c => c.id === machine.clientId);
        const clientName = client ? client.name.toLowerCase() : '';
        return clientName.includes(searchClientVal);
    });

    if (filteredMachines.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="13" class="text-center py-4">No se encontraron alquileres o clientes activos para los filtros.</td></tr>`;
        return;
    }

    // Sort machines by client name
    filteredMachines.sort((a, b) => {
        const nameA = (state.clients.find(c => c.id === a.clientId)?.name || '').toLowerCase();
        const nameB = (state.clients.find(c => c.id === b.clientId)?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    let renderedRows = 0;

    filteredMachines.forEach(machine => {
        const client = state.clients.find(c => c.id === machine.clientId);
        const abono = state.abonos.find(a => a.id === machine.abonoId);
        const reading = state.readings.find(r => r.machineId === machine.id && r.month === currentMonth);

        // Apply state/status filters
        if (filterStatus === 'pending') {
            if (!reading || reading.status !== 'pending') return;
        } else if (filterStatus === 'paid') {
            if (!reading || reading.status !== 'paid') return;
        } else if (filterStatus === 'unregistered') {
            if (reading) return;
        }

        renderedRows++;

        const clientName = client ? client.name : 'Cliente no encontrado';
        const abonoName = abono ? abono.name : 'Plan no encontrado';
        
        let initialVal = '-', finalVal = '-', copies = '-', excess = '-', fixedCost = '-', excessCost = '-', ivaVal = '-', total = '-';
        let statusBadge = `<span class="badge danger">Falta Lectura</span>`;
        let actions = `<button class="btn btn-primary btn-sm" onclick="addReadingTrigger('${machine.id}')">Registrar</button>`;

        if (abono) {
            fixedCost = formatCurrency(abono.price);
            const ivaRate = machine.applyIva ? (abono.ivaRate || 0) : 0;
            
            if (reading) {
                initialVal = reading.initial.toLocaleString('es-AR');
                finalVal = reading.final.toLocaleString('es-AR');
                const diff = Math.max(0, reading.final - reading.initial);
                copies = diff.toLocaleString('es-AR');
                
                const exc = Math.max(0, diff - abono.limit);
                excess = exc.toLocaleString('es-AR');
                
                const excCost = exc * abono.excessPrice;
                excessCost = formatCurrency(excCost);
                
                const netCost = abono.price + excCost;
                const ivaCost = netCost * (ivaRate / 100);
                const tot = netCost + ivaCost;
                
                ivaVal = formatCurrency(ivaCost) + (machine.applyIva && ivaRate > 0 ? ` (${ivaRate}%)` : ' (No IVA)');
                total = formatCurrency(tot);

                if (reading.status === 'paid') {
                    statusBadge = `<span class="badge success">Cobrado</span>`;
                } else {
                    statusBadge = `<span class="badge warning">Pendiente</span>`;
                }

                actions = `
                    <div class="flex-actions-row">
                        <button class="btn btn-secondary btn-sm" onclick="editReadingTrigger('${reading.id}')" title="Editar lectura">Editar</button>
                        <button class="btn btn-primary btn-sm" onclick="viewInvoiceTrigger('${reading.id}')" title="Ver comprobante e imprimir">Recibo</button>
                    </div>
                `;
            } else {
                // Projected base pricing if reading hasn't been logged yet
                const netCost = abono.price;
                const ivaCost = netCost * (ivaRate / 100);
                const tot = netCost + ivaCost;
                ivaVal = formatCurrency(ivaCost) + (machine.applyIva && ivaRate > 0 ? ` (${ivaRate}%)` : ' (No IVA)');
                total = formatCurrency(tot);
            }
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="font-bold-title">${clientName}</td>
            <td>${machine.brand || ''} ${machine.model} <span class="text-xs text-secondary-light">(${machine.serial})</span></td>
            <td class="text-xs">${abonoName}</td>
            <td>${initialVal}</td>
            <td>${finalVal}</td>
            <td><strong>${copies}</strong></td>
            <td class="${parseInt(excess) > 0 ? 'text-amber font-semibold' : ''}">${excess}</td>
            <td>${fixedCost}</td>
            <td>${excessCost}</td>
            <td>${ivaVal}</td>
            <td><strong class="text-indigo">${total}</strong></td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
        `;
        tableBody.appendChild(row);
    });

    if (renderedRows === 0) {
        tableBody.innerHTML = `<tr><td colspan="13" class="text-center py-4">No hay lecturas cargadas correspondientes a este filtro.</td></tr>`;
    }

    // Attach local search handler if not already done (prevents double listeners by replacing element or assigning to input event)
    const clientSearchInput = document.getElementById('search-reading-client');
    if (!clientSearchInput.hasAttribute('data-wired')) {
        clientSearchInput.setAttribute('data-wired', 'true');
        clientSearchInput.addEventListener('input', renderReadingsTab);
    }
    
    const statusFilterSelect = document.getElementById('filter-reading-status');
    if (!statusFilterSelect.hasAttribute('data-wired')) {
        statusFilterSelect.setAttribute('data-wired', 'true');
        statusFilterSelect.addEventListener('change', renderReadingsTab);
    }
}

// Tab View: History Tab (Global Billings Ledger)
function renderHistoryTab() {
    const tableBody = document.querySelector('#history-table tbody');
    tableBody.innerHTML = '';

    const searchVal = document.getElementById('search-history').value.toLowerCase();
    const statusFilter = document.getElementById('filter-history-status').value;

    const filteredReadings = state.readings.filter(reading => {
        let client = state.clients.find(c => c.id === reading.clientId);
        const machine = state.machines.find(m => m.id === reading.machineId);
        if (!client && machine) {
            client = state.clients.find(c => c.id === machine.clientId);
        }
        const clientName = client ? client.name.toLowerCase() : '';
        const machineName = machine ? `${machine.brand || ''} ${machine.model}`.toLowerCase() : '';
        
        const matchesSearch = clientName.includes(searchVal) || machineName.includes(searchVal);
        
        let matchesStatus = true;
        if (statusFilter === 'paid') {
            matchesStatus = reading.status === 'paid';
        } else if (statusFilter === 'pending') {
            matchesStatus = reading.status === 'pending';
        }

        return matchesSearch && matchesStatus;
    });

    // Sort by period/month descending, then client name
    filteredReadings.sort((a, b) => {
        if (b.month !== a.month) {
            return b.month.localeCompare(a.month);
        }
        const clientA = state.clients.find(c => c.id === a.clientId);
        const clientB = state.clients.find(c => c.id === b.clientId);
        const nameA = (clientA?.name || '').toLowerCase();
        const nameB = (clientB?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    if (filteredReadings.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="13" class="text-center py-4">No se encontraron registros en el historial.</td></tr>`;
        return;
    }

    filteredReadings.forEach(reading => {
        const machine = state.machines.find(m => m.id === reading.machineId);
        let client = state.clients.find(c => c.id === reading.clientId);
        if (!client && machine) {
            client = state.clients.find(c => c.id === machine.clientId);
        }
        const abono = state.abonos.find(a => a.id === reading.abonoId) || (machine ? state.abonos.find(a => a.id === machine.abonoId) : null);

        const clientName = client ? client.name : 'Cliente no asignado';
        const machineName = machine ? `${machine.brand || ''} ${machine.model}` : 'Equipo no encontrado';
        const abonoName = abono ? abono.name : '-';
        
        let initialVal = reading.initial.toLocaleString('es-AR');
        let finalVal = reading.final.toLocaleString('es-AR');
        const diff = Math.max(0, reading.final - reading.initial);
        const copies = diff.toLocaleString('es-AR');
        
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const excess = exc.toLocaleString('es-AR');
        
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? (exc * abono.excessPrice) : 0;
        const netCost = fixedCost + excessCost;
        
        const serialNum = machine ? machine.serial : 'N/A';
        const applyIva = machine ? machine.applyIva : false;
        const ivaRate = applyIva && abono ? (abono.ivaRate || 0) : 0;
        const ivaCost = netCost * (ivaRate / 100);
        const totalCost = netCost + ivaCost;

        let statusBadge = reading.status === 'paid' 
            ? `<span class="badge success">Cobrado</span>`
            : `<span class="badge warning">Pendiente</span>`;

        let actions = `
            <div class="flex-actions-row">
                <button class="btn btn-secondary btn-sm" onclick="editReadingTrigger('${reading.id}')">Editar</button>
                <button class="btn btn-primary btn-sm" onclick="viewInvoiceTrigger('${reading.id}')">Recibo</button>
            </div>
        `;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${formatPeriod(reading.month)}</strong></td>
            <td class="font-bold-title">${clientName}</td>
            <td>${machineName} <span class="text-xs text-secondary-light">(${serialNum})</span></td>
            <td class="text-xs">${abonoName}</td>
            <td>${initialVal}</td>
            <td>${finalVal}</td>
            <td><strong>${copies}</strong></td>
            <td class="${exc > 0 ? 'text-amber font-semibold' : ''}">${excess}</td>
            <td>${formatCurrency(netCost)}</td>
            <td>${formatCurrency(ivaCost)} <span class="text-xs text-secondary-light">(${ivaRate > 0 ? ivaRate + '%' : 'No IVA'})</span></td>
            <td><strong class="text-indigo">${formatCurrency(totalCost)}</strong></td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
        `;
        tableBody.appendChild(row);
    });

    // Search and filters listeners
    const searchInput = document.getElementById('search-history');
    if (!searchInput.hasAttribute('data-wired')) {
        searchInput.setAttribute('data-wired', 'true');
        searchInput.addEventListener('input', renderHistoryTab);
    }

    const filterSelect = document.getElementById('filter-history-status');
    if (!filterSelect.hasAttribute('data-wired')) {
        filterSelect.setAttribute('data-wired', 'true');
        filterSelect.addEventListener('change', renderHistoryTab);
    }
}

// Tab View 3: Clients List
function renderClientsTab() {
    const tableBody = document.querySelector('#clients-table tbody');
    tableBody.innerHTML = '';
    
    const searchVal = document.getElementById('search-client').value.toLowerCase();
    
    const filtered = state.clients.filter(c => {
        return c.name.toLowerCase().includes(searchVal) || c.address.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No se encontraron clientes. Haz clic en "Agregar Cliente".</td></tr>`;
        return;
    }

    filtered.forEach(client => {
        // Machines assigned to client
        const assignedMachines = state.machines.filter(m => m.clientId === client.id);
        const machinesStr = assignedMachines.map(m => {
            const abono = state.abonos.find(a => a.id === m.abonoId);
            if (abono) {
                const ivaRate = m.applyIva ? (abono.ivaRate || 0) : 0;
                const totalFixed = abono.price * (1 + ivaRate / 100);
                const ivaLabel = m.applyIva && ivaRate > 0 ? `IVA ${ivaRate}%` : 'No IVA';
                return `
                    <div class="assigned-machine-block mb-1" style="padding: 6px; background: rgba(0,0,0,0.02); border-radius: 4px; border: 1px solid rgba(0,0,0,0.05); margin-bottom: 4px;">
                        <strong>${m.brand || ''} ${m.model}</strong> <span class="text-xs text-secondary-light">(${m.serial})</span>
                        <div class="text-xs text-indigo mt-0.5" style="font-weight: 500;">
                            ${abono.name} - Fijo: <strong>${formatCurrency(totalFixed)}</strong> (${ivaLabel})
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="assigned-machine-block mb-1" style="padding: 6px; background: rgba(0,0,0,0.02); border-radius: 4px; border: 1px solid rgba(0,0,0,0.05); margin-bottom: 4px;">
                        <strong>${m.brand || ''} ${m.model}</strong> <span class="text-xs text-secondary-light">(${m.serial})</span>
                        <div class="text-xs text-secondary-light mt-0.5">Sin plan asignado</div>
                    </div>
                `;
            }
        }).join('') || '<span class="text-xs text-secondary-light">Sin máquinas asignadas</span>';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="font-bold-title">${client.name}</td>
            <td>
                <span class="text-sm d-block">📞 ${client.phone || '-'}</span>
                <span class="text-xs text-secondary-light d-block">✉️ ${client.email || '-'}</span>
            </td>
            <td>${client.address || '-'}</td>
            <td>${machinesStr}</td>
            <td class="text-xs italic">${client.notes || '-'}</td>
            <td>
                <div class="flex-actions-row">
                    <button class="btn btn-secondary btn-sm" onclick="openClientReportTrigger('${client.id}')">📋 Reporte</button>
                    <button class="btn btn-secondary btn-sm" onclick="editClientTrigger('${client.id}')">Editar</button>
                    <button class="btn btn-danger-outline btn-sm" onclick="deleteClientTrigger('${client.id}')">Eliminar</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    const clientSearch = document.getElementById('search-client');
    if (!clientSearch.hasAttribute('data-wired')) {
        clientSearch.setAttribute('data-wired', 'true');
        clientSearch.addEventListener('input', renderClientsTab);
    }
}

// Tab View 4: Machines Inventory
function renderMachinesTab() {
    const tableBody = document.querySelector('#machines-table tbody');
    tableBody.innerHTML = '';

    const searchVal = document.getElementById('search-machine').value.toLowerCase();
    const filterStatus = document.getElementById('filter-machine-status').value;

    const filtered = state.machines.filter(m => {
        const brandLower = (m.brand || '').toLowerCase();
        const modelLower = (m.model || '').toLowerCase();
        const serialLower = (m.serial || '').toLowerCase();
        const matchesSearch = brandLower.includes(searchVal) || modelLower.includes(searchVal) || serialLower.includes(searchVal);

        let matchesStatus = false;
        if (filterStatus === 'all') {
            matchesStatus = true;
        } else if (filterStatus === 'rented') {
            matchesStatus = !!m.clientId;
        } else if (filterStatus === 'available') {
            matchesStatus = !m.clientId;
        } else {
            matchesStatus = m.status === filterStatus;
        }

        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No hay máquinas registradas que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    filtered.forEach(machine => {
        const client = state.clients.find(c => c.id === machine.clientId);
        const abono = state.abonos.find(a => a.id === machine.abonoId);

        let clientCellHtml = '';
        if (client) {
            const dateFmt = machine.installationDate ? machine.installationDate.split('-').reverse().join('/') : 'N/A';
            const counterFmt = machine.initialCounter ? machine.initialCounter.toLocaleString('es-AR') : '0';
            clientCellHtml = `
                <div class="font-bold-title">${client.name}</div>
                <div class="text-xs text-secondary-light">Instalación: ${dateFmt}</div>
                <div class="text-xs text-secondary-light">Contador Inicial: ${counterFmt}</div>
            `;
        } else {
            clientCellHtml = '<span class="text-xs text-secondary-light">Disponible</span>';
        }

        const abonoName = abono ? abono.name : '-';

        let statusBadge = '';
        if (machine.status === 'Nuevo') {
            statusBadge = `<span class="badge success">Nuevo</span>`;
        } else if (machine.status === 'Usado') {
            statusBadge = `<span class="badge bg-indigo-light text-indigo">Usado</span>`;
        } else if (machine.status === 'En Servicio') {
            statusBadge = `<span class="badge success">En Servicio</span>`;
        } else if (machine.status === 'Scrap') {
            statusBadge = `<span class="badge danger">Scrap</span>`;
        } else {
            statusBadge = `<span class="badge warning">No funciona</span>`;
        }

        const isAvailable = machine.isAvailable !== false;
        const availBadge = isAvailable
            ? `<span class="badge" style="background-color:rgba(16,185,129,0.12); color:var(--emerald); border-color:rgba(16,185,129,0.15); margin-top:4px; display:inline-block;">Apta Venta/Alquiler</span>`
            : `<span class="badge" style="background-color:rgba(239,68,68,0.12); color:var(--danger); border-color:rgba(239,68,68,0.15); margin-top:4px; display:inline-block;">No Disponible</span>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="font-bold-title">${machine.brand || ''} ${machine.model || ''}</td>
            <td><code>${machine.serial}</code></td>
            <td>${machine.type}</td>
            <td>${clientCellHtml}</td>
            <td>${abonoName}</td>
            <td>
                ${statusBadge}
                ${availBadge}
                <span class="text-xs text-secondary-light d-block" style="margin-top:4px;">Contador: ${(machine.machineCounter || 0).toLocaleString('es-AR')}</span>
            </td>
            <td>
                <div class="flex-actions-row">
                    <button class="btn btn-secondary btn-sm" onclick="openMachineReportTrigger('${machine.id}')">📋 Reporte</button>
                    <button class="btn btn-secondary btn-sm" onclick="editMachineTrigger('${machine.id}')">${state.currentUser?.role === 'tecnico' ? 'Ver Detalle' : 'Editar'}</button>
                    ${machine.clientId ? `<button class="btn btn-secondary btn-sm" onclick="openRentalDetailModal('${machine.id}')">📂 Expediente</button>` : ''}
                    ${state.currentUser?.role !== 'tecnico' ? `<button class="btn btn-danger-outline btn-sm" onclick="deleteMachineTrigger('${machine.id}')">Eliminar</button>` : ''}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    const searchInput = document.getElementById('search-machine');
    if (!searchInput.hasAttribute('data-wired')) {
        searchInput.setAttribute('data-wired', 'true');
        searchInput.addEventListener('input', renderMachinesTab);
    }

    const filterSelect = document.getElementById('filter-machine-status');
    if (!filterSelect.hasAttribute('data-wired')) {
        filterSelect.setAttribute('data-wired', 'true');
        filterSelect.addEventListener('change', renderMachinesTab);
    }
}

// Tab View 5: Abonos Template Configuration
function renderAbonosTab() {
    const tableBody = document.querySelector('#abonos-table tbody');
    tableBody.innerHTML = '';

    if (state.abonos.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No hay planes de abonos registrados.</td></tr>`;
        return;
    }

    state.abonos.forEach(abono => {
        // Calculate how many active machines use this abono
        const activeUsageCount = state.machines.filter(m => m.abonoId === abono.id).length;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="font-bold-title">${abono.name}</td>
            <td><strong>${abono.limit.toLocaleString('es-AR')}</strong> copias/imp.</td>
            <td>
                <strong class="text-emerald">${formatCurrency(abono.price)}</strong>
                <span class="text-xs text-secondary-light d-block" style="margin-top:2px;">(IVA: ${abono.ivaRate !== undefined ? abono.ivaRate : 21}%)</span>
            </td>
            <td><strong>${formatCurrency(abono.excessPrice)}</strong> / copia</td>
            <td><span class="badge">${activeUsageCount} equipos</span></td>
            <td>
                <div class="flex-actions-row">
                    <button class="btn btn-secondary btn-sm" onclick="editAbonoTrigger('${abono.id}')">Editar</button>
                    <button class="btn btn-danger-outline btn-sm" onclick="deleteAbonoTrigger('${abono.id}')">Eliminar</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Export / Import Data logic
function exportDataToJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 4));
    const downloadAnchor = document.createElement('a');
    
    const timestamp = new Date().toISOString().slice(0, 10);
    
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `copyrent-respaldo-${timestamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    showToast('Archivo de respaldo descargado correctamente', 'success');
}

function importDataFromJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            
            // Validate basic structure
            if (importedData.clients && importedData.machines && importedData.abonos && importedData.readings) {
                // Keep the current users list and session if the imported file does not contain users
                const currentUsers = state.users;
                const currentSession = state.currentUser;

                state = importedData;

                if (!state.users || state.users.length === 0) {
                    state.users = currentUsers && currentUsers.length > 0 ? currentUsers : [
                        {
                            id: 'user-admin',
                            username: 'dmoyano',
                            fullname: 'Darío Moyano',
                            email: 'dmoyano@mstecnologia.com.ar',
                            password: 'jUEVES2389$',
                            role: 'administrativo',
                            phone: '5491133445566'
                        }
                    ];
                }
                if (state.currentUser === undefined || state.currentUser === null) {
                    state.currentUser = currentSession;
                }
                if (!state.settings) {
                    state.settings = {
                        reminder7Days: true,
                        reminder3Days: true,
                        reminder1Day: true
                    };
                }
                if (!state.tickets) {
                    state.tickets = [];
                }

                saveToLocalStorage();
                checkAuthSession(); // Ensure layout & sidebar is loaded
                showToast('Base de datos restaurada con éxito', 'success');
            } else {
                showToast('Estructura de archivo JSON inválida', 'error');
            }
        } catch (error) {
            showToast('Error al leer el archivo JSON', 'error');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

// Utilities Helpers
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(amount);
}

function formatPeriod(periodStr) {
    // periodStr: '2026-06'
    if (!periodStr) return '';
    const [year, month] = periodStr.split('-');
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function getPreviousMonthString(periodStr) {
    // periodStr: '2026-06'
    const [year, month] = periodStr.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = year - 1;
    }
    
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

// Customized toast alert system
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <span>${icon}</span>
            <span>${message}</span>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove toast
    const autoRemove = setTimeout(() => {
        toast.style.animation = 'toastSlideIn var(--transition-fast) ease-out reverse';
        setTimeout(() => toast.remove(), 200);
    }, 4000);

    // Close button trigger
    toast.querySelector('.toast-close').onclick = () => {
        clearTimeout(autoRemove);
        toast.remove();
    };
}

// Maintenance History Operations
function getLatestCounterForMachine(machineId) {
    const machine = state.machines.find(m => m.id === machineId);
    if (!machine) return 0;

    // Find all monthly readings for this machine
    const machineReadings = state.readings.filter(r => r.machineId === machineId);
    if (machineReadings.length > 0) {
        // Sort by final counter descending
        machineReadings.sort((a, b) => b.final - a.final);
        return machineReadings[0].final;
    }

    // Default to the installation initial counter
    return machine.initialCounter || 0;
}

window.openMaintenanceHistoryTrigger = (machineId) => {
    const machine = state.machines.find(m => m.id === machineId);
    const client = state.clients.find(c => c.id === machine.clientId);
    if (!machine) return;

    // Set descriptors
    document.getElementById('maintenance-history-machine-desc').textContent = 
        `${machine.model} (S/N: ${machine.serial}) | Cliente: ${client ? client.name : 'N/A'}`;

    // Store machineId in the "Registrar Cambio" button/form hidden field
    document.getElementById('form-maintenance').querySelector('#maintenance-machine-id').value = machineId;
    document.getElementById('maintenance-entry-id').value = '';

    renderMaintenanceHistoryTable(machineId);

    // Show modal
    document.getElementById('modal-maintenance-history').style.display = 'block';
};

function renderMaintenanceHistoryTable(machineId) {
    const tableBody = document.querySelector('#maintenance-table tbody');
    tableBody.innerHTML = '';

    // Filter maintenance entries for this machine
    const entries = state.maintenance.filter(e => e.machineId === machineId);

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (entries.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-secondary-light">No hay registros de mantenimiento ni cambios de insumos cargados para este equipo.</td></tr>`;
        return;
    }

    entries.forEach(entry => {
        const dateFmt = entry.date ? entry.date.split('-').reverse().join('/') : 'N/A';
        
        let typeBadge = '';
        if (entry.type === 'Insumo') {
            typeBadge = `<span class="badge" style="background-color: var(--indigo-light); color: var(--indigo); border-color: rgba(99, 102, 241, 0.2);">${entry.type}</span>`;
        } else if (entry.type === 'Repuesto') {
            typeBadge = `<span class="badge" style="background-color: var(--amber-light); color: var(--amber); border-color: rgba(245, 158, 11, 0.2);">${entry.type}</span>`;
        } else {
            typeBadge = `<span class="badge" style="background-color: rgba(16, 185, 129, 0.15); color: var(--emerald); border-color: rgba(16, 185, 129, 0.2);">${entry.type}</span>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${dateFmt}</strong></td>
            <td>${typeBadge}</td>
            <td class="font-bold-title">${entry.description}</td>
            <td><strong>${entry.counter.toLocaleString('es-AR')}</strong> copias</td>
            <td>
                <div class="flex-actions-row">
                    <button class="btn btn-secondary btn-sm" onclick="editMaintenanceEntryTrigger('${entry.id}')">Editar</button>
                    <button class="btn btn-danger-outline btn-sm" onclick="deleteMaintenanceEntryTrigger('${entry.id}')">Eliminar</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

window.openAddMaintenanceTrigger = (machineId, entryId = null) => {
    const form = document.getElementById('form-maintenance');
    form.reset();

    const titleEl = document.getElementById('modal-add-maintenance-title');
    
    document.getElementById('maintenance-machine-id').value = machineId;
    document.getElementById('maintenance-entry-id').value = entryId || '';

    // Sincronizar / Prefill latest counter
    const defaultCounter = getLatestCounterForMachine(machineId);
    document.getElementById('maintenance-sync-hint').textContent = `Lectura sugerida: ${defaultCounter.toLocaleString('es-AR')} copias.`;

    if (entryId) {
        titleEl.textContent = 'Editar Registro de Mantenimiento';
        const entry = state.maintenance.find(e => e.id === entryId);
        if (entry) {
            document.getElementById('maintenance-type').value = entry.type;
            document.getElementById('maintenance-date').value = entry.date;
            document.getElementById('maintenance-description').value = entry.description;
            document.getElementById('maintenance-counter').value = entry.counter;
        }
    } else {
        titleEl.textContent = 'Registrar Cambio de Insumo/Repuesto';
        // Date prefill to today
        document.getElementById('maintenance-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('maintenance-counter').value = defaultCounter;
    }

    document.getElementById('modal-add-maintenance').style.display = 'block';
};

window.editMaintenanceEntryTrigger = (entryId) => {
    const entry = state.maintenance.find(e => e.id === entryId);
    if (entry) {
        openAddMaintenanceTrigger(entry.machineId, entry.id);
    }
};

window.deleteMaintenanceEntryTrigger = (entryId) => {
    if (confirm('¿Seguro que deseas eliminar este registro del historial?')) {
        const entry = state.maintenance.find(e => e.id === entryId);
        const machineId = entry ? entry.machineId : null;
        
        state.maintenance = state.maintenance.filter(e => e.id !== entryId);
        dbDelete('maintenance', entryId);
        
        if (machineId) {
            renderMaintenanceHistoryTable(machineId);
        }
        showToast('Registro eliminado del historial', 'warning');
    }
};

async function saveMaintenanceEntry() {
    const id = document.getElementById('maintenance-entry-id').value;
    const machineId = document.getElementById('maintenance-machine-id').value;
    const type = document.getElementById('maintenance-type').value;
    const date = document.getElementById('maintenance-date').value;
    const description = document.getElementById('maintenance-description').value;
    const counter = parseInt(document.getElementById('maintenance-counter').value) || 0;

    const machine = state.machines.find(m => m.id === machineId);
    if (machine && counter < (machine.initialCounter || 0)) {
        if (!confirm(`El contador ingresado (${counter}) es menor al contador inicial de instalación (${machine.initialCounter}). ¿Deseas guardar de todas formas?`)) {
            return;
        }
    }

    const entryData = {
        id: id || ('maint-' + Date.now()),
        machineId,
        type,
        date,
        description,
        counter
    };

    if (id) {
        const idx = state.maintenance.findIndex(e => e.id === id);
        if (idx !== -1) {
            state.maintenance[idx] = entryData;
            showToast('Registro actualizado con éxito', 'success');
        }
    } else {
        state.maintenance.push(entryData);
        showToast('Registro guardado en el historial', 'success');
    }

    dbSet('maintenance', entryData.id, entryData);
    document.getElementById('modal-add-maintenance').style.display = 'none';
    renderMaintenanceHistoryTable(machineId);
}

// User Management Views and Operations
function renderUsersTab() {
    const tableBody = document.querySelector('#users-table tbody');
    tableBody.innerHTML = '';

    if (state.users.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-secondary-light">No hay usuarios registrados.</td></tr>`;
        return;
    }

    state.users.forEach(user => {
        const row = document.createElement('tr');
        
        // Safety guard: can't delete dmoyano
        const isMaster = user.username === 'dmoyano';
        const deleteBtnHtml = isMaster 
            ? `<button class="btn btn-sm btn-secondary" style="opacity: 0.5; cursor: not-allowed;" disabled title="El administrador maestro no puede ser eliminado">No Eliminar</button>`
            : `<button class="btn btn-danger-outline btn-sm" onclick="deleteUserTrigger('${user.id}')">Eliminar</button>`;

        const userRole = user.role || 'administrativo';
        const roleLabel = userRole === 'tecnico' ? 'Técnico' : 'Administrativo';
        const roleBadge = userRole === 'tecnico' 
            ? `<span class="badge warning" style="color:#d97706; background-color:rgba(245,158,11,0.12); font-weight:600;">Técnico</span>` 
            : `<span class="badge success" style="font-weight:600;">Administrativo</span>`;

        row.innerHTML = `
            <td><strong>${user.username}</strong> ${isMaster ? '<span class="badge success" style="font-size:9px; padding:1px 4px; margin-left:4px;">Master</span>' : ''}</td>
            <td>${user.fullname}</td>
            <td>${roleBadge}</td>
            <td><strong>${user.phone || 'N/A'}</strong></td>
            <td>${user.email}</td>
            <td style="font-family: monospace;">••••••••</td>
            <td>
                <div class="flex-actions-row">
                    <button class="btn btn-secondary btn-sm" onclick="editUserTrigger('${user.id}')">Editar</button>
                    ${deleteBtnHtml}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openUserModal(userId = null) {
    const userRole = state.currentUser ? (state.currentUser.role || 'administrativo') : 'administrativo';
    if (userRole === 'tecnico') {
        showToast('Acceso denegado: Privilegios insuficientes', 'error');
        return;
    }
    const modal = document.getElementById('modal-user');
    const form = document.getElementById('form-user');
    form.reset();

    const titleEl = document.getElementById('modal-user-title');
    const idInput = document.getElementById('user-id');
    const usernameInput = document.getElementById('user-username');

    if (userId) {
        titleEl.textContent = 'Editar Usuario';
        const user = state.users.find(u => u.id === userId);
        if (user) {
            idInput.value = user.id;
            usernameInput.value = user.username;
            document.getElementById('user-fullname').value = user.fullname;
            document.getElementById('user-email').value = user.email;
            document.getElementById('user-password').value = user.password;
            document.getElementById('user-role').value = user.role || 'administrativo';
            document.getElementById('user-phone').value = user.phone || '';

            if (user.username === 'dmoyano') {
                usernameInput.disabled = true;
                document.getElementById('user-role').disabled = true; // master admin role locked to admin
            } else {
                usernameInput.disabled = false;
                document.getElementById('user-role').disabled = false;
            }
        }
    } else {
        titleEl.textContent = 'Agregar Usuario';
        idInput.value = '';
        usernameInput.disabled = false;
        document.getElementById('user-role').disabled = false;
        document.getElementById('user-role').value = 'administrativo';
        document.getElementById('user-phone').value = '';
    }

    modal.style.display = 'block';
}

window.editUserTrigger = (userId) => {
    openUserModal(userId);
};

window.deleteUserTrigger = (userId) => {
    const userRole = state.currentUser ? (state.currentUser.role || 'administrativo') : 'administrativo';
    if (userRole === 'tecnico') {
        showToast('Acceso denegado: Privilegios insuficientes', 'error');
        return;
    }
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    if (user.username === 'dmoyano') {
        showToast('No se puede eliminar el usuario administrador maestro (dmoyano)', 'error');
        return;
    }

    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${user.username}"?`)) {
        state.users = state.users.filter(u => u.id !== userId);
        dbDelete('users', userId);
        showToast('Usuario eliminado con éxito', 'warning');
        renderUsersTab();
    }
};

function setupFirebaseControls() {
    // Form config connection
    document.getElementById('form-firebase-config').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const config = {
            apiKey: document.getElementById('fb-api-key').value.trim(),
            authDomain: document.getElementById('fb-auth-domain').value.trim(),
            projectId: document.getElementById('fb-project-id').value.trim(),
            storageBucket: document.getElementById('fb-storage-bucket').value.trim(),
            messagingSenderId: document.getElementById('fb-messaging-sender-id').value.trim(),
            appId: document.getElementById('fb-app-id').value.trim()
        };
        
        if (!config.apiKey || !config.projectId) {
            showToast("Por favor completa los campos principales de Firebase.", "error");
            return;
        }
        
        try {
            showToast("Conectando con Firebase Firestore...", "info");
            localStorage.setItem('firebase_config', JSON.stringify(config));
            
            // Re-initialize database
            await loadDatabase();
            
            if (firebaseActive) {
                showToast("Conectado a Firebase con éxito.", "success");
                renderApp();
            }
        } catch (err) {
            console.error(err);
            showToast("Error al conectar. Verifica las credenciales.", "error");
        }
    });
    
    // Disconnect button
    document.getElementById('btn-disconnect-firebase').addEventListener('click', () => {
        if (confirm("¿Seguro que deseas desconectar Firebase? La aplicación volverá a usar el almacenamiento local (localStorage).")) {
            localStorage.removeItem('firebase_config');
            firebaseActive = false;
            db = null;
            
            // Load local data again
            loadFromLocalStorage();
            updateFirebaseUI(false);
            
            // Clean inputs
            document.getElementById('form-firebase-config').reset();
            
            renderApp();
            showToast("Desconectado de Firebase. Volviendo a almacenamiento local.", "warning");
        }
    });
    
    // Upload local storage database to Firestore
    document.getElementById('btn-upload-local-to-firebase').addEventListener('click', async () => {
        if (!firebaseActive || !db) {
            showToast("Firebase no está conectado.", "error");
            return;
        }
        
        if (confirm("ATENCIÓN: Esto subirá todos los datos locales de este navegador a la nube de Firebase, combinándose o sobrescribiendo los existentes en Firestore. ¿Deseas continuar?")) {
            try {
                showToast("Subiendo datos locales a la nube...", "info");
                
                // Get local copy rent data
                const saved = localStorage.getItem('copyrent_data');
                if (saved) {
                    const localState = JSON.parse(saved);
                    
                    // Upload clients
                    if (localState.clients) {
                        for (const client of localState.clients) {
                            await db.collection('clients').doc(client.id).set(client);
                        }
                    }
                    
                    // Upload machines
                    if (localState.machines) {
                        for (const machine of localState.machines) {
                            await db.collection('machines').doc(machine.id).set(machine);
                        }
                    }
                    
                    // Upload abonos
                    if (localState.abonos) {
                        for (const abono of localState.abonos) {
                            await db.collection('abonos').doc(abono.id).set(abono);
                        }
                    }
                    
                    // Upload readings
                    if (localState.readings) {
                        for (const reading of localState.readings) {
                            await db.collection('readings').doc(reading.id).set(reading);
                        }
                    }
                    
                    // Upload maintenance
                    if (localState.maintenance) {
                        for (const maint of localState.maintenance) {
                            await db.collection('maintenance').doc(maint.id).set(maint);
                        }
                    }
                    
                    // Upload users
                    if (localState.users) {
                        for (const user of localState.users) {
                            await db.collection('users').doc(user.id).set(user);
                        }
                    }
                    
                    // Upload tickets
                    if (localState.tickets) {
                        for (const ticket of localState.tickets) {
                            await db.collection('tickets').doc(ticket.id).set(ticket);
                        }
                    }
                    
                    // Upload logo
                    if (localState.companyLogo) {
                        await db.collection('settings').doc('companyLogo').set({ value: localState.companyLogo });
                    }
                    
                    showToast("Sincronización completa. Todos los datos locales están en la nube.", "success");
                    // Refresh data from cloud to be aligned
                    await fetchCloudData();
                    renderApp();
                } else {
                    showToast("No hay datos locales para subir.", "warning");
                }
            } catch (err) {
                console.error("Error uploading to Firebase:", err);
                showToast("Error al subir los datos a la nube.", "error");
            }
        }
    });
}

async function clearFirestoreCollections() {
    if (firebaseActive && db) {
        try {
            const deleteCol = async (colName) => {
                const snap = await db.collection(colName).get();
                const batch = db.batch();
                let count = 0;
                snap.forEach(doc => {
                    batch.delete(doc.ref);
                    count++;
                });
                if (count > 0) {
                    await batch.commit();
                }
            };
            
            await deleteCol('clients');
            await deleteCol('machines');
            await deleteCol('abonos');
            await deleteCol('readings');
            await deleteCol('maintenance');
            await deleteCol('tickets');
            // We do NOT clear the 'users' collection to avoid administrative lockouts!
        } catch (err) {
            console.error("Error clearing Firestore collections:", err);
        }
    }
}

async function syncStateToFirestore() {
    if (firebaseActive && db) {
        try {
            showToast("Sincronizando nuevos datos con la nube...", "info");
            
            // Upload current state items
            for (const c of state.clients) await db.collection('clients').doc(c.id).set(c);
            for (const m of state.machines) await db.collection('machines').doc(m.id).set(m);
            for (const a of state.abonos) await db.collection('abonos').doc(a.id).set(a);
            for (const r of state.readings) await db.collection('readings').doc(r.id).set(r);
            for (const mt of state.maintenance) await db.collection('maintenance').doc(mt.id).set(mt);
            for (const u of state.users) {
                await db.collection('users').doc(u.id).set(u);
            }
            for (const t of state.tickets || []) {
                await db.collection('tickets').doc(t.id).set(t);
            }
            
            if (state.companyLogo) {
                await db.collection('settings').doc('companyLogo').set({ value: state.companyLogo });
            }
        } catch (err) {
            console.error("Error syncing state to Firestore:", err);
            showToast("Error al sincronizar datos con la nube.", "error");
        }
    }
}

// Sanitization helper to protect against XSS injections
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Web Audio API notification sound synthesis (no audio file dependencies)
function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Note 1 (D5)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.15);
        
        // Note 2 (A5) after a small delay
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
            gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.3);
        }, 80);
    } catch (e) {
        console.warn("AudioContext not allowed or supported yet:", e);
    }
}

// Pop Notification Manager
function checkPopNotifications() {
    if (sessionStorage.getItem('notified_readings_this_session') === 'true') {
        return; // Already notified in this session
    }

    const popModal = document.getElementById('modal-notification-pop');
    const popList = document.getElementById('pop-notification-list');
    if (!popModal || !popList) return;

    popList.innerHTML = '';
    
    const today = new Date();
    const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const activeRentals = state.machines.filter(m => m.clientId);
    const urgentAlerts = [];

    activeRentals.forEach(machine => {
        // Check if reading is already loaded for current month
        const reading = state.readings.find(r => r.machineId === machine.id && r.month === currentMonth);
        if (reading) return;

        const client = state.clients.find(c => c.id === machine.clientId);
        if (!client) return;

        const readingDay = machine.readingDay || 10;
        const deadline = new Date(today.getFullYear(), today.getMonth(), readingDay);
        const diffTime = deadline - todayNormalized;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // High priority: overdue or due today
        if (diffDays <= 0) {
            let label = '';
            if (diffDays < 0) {
                label = `Atrasado por ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'día' : 'días'}`;
            } else {
                label = 'Vence hoy';
            }

            urgentAlerts.push({
                clientName: client.name,
                machineDesc: `${machine.brand || ''} ${machine.model} (${machine.serial})`,
                label,
                readingDay
            });
        }
    });

    if (urgentAlerts.length > 0) {
        // Play chime sound
        playNotificationSound();

        // Render list items
        urgentAlerts.forEach(alert => {
            const li = document.createElement('li');
            li.style.padding = '8px 12px';
            li.style.borderRadius = '6px';
            li.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            li.style.border = '1px solid rgba(239, 68, 68, 0.15)';
            li.style.color = 'var(--danger)';
            li.style.fontSize = '12px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            li.innerHTML = `
                <div>
                    <strong>${alert.clientName}</strong> - <span style="color:var(--text-secondary);">${alert.machineDesc}</span>
                </div>
                <span class="badge" style="background-color: var(--danger-light); color: var(--danger); font-size:10px; font-weight:700; text-transform:uppercase;">${alert.label}</span>
            `;
            popList.appendChild(li);
        });

        // Set session storage flag to prevent repeating
        sessionStorage.setItem('notified_readings_this_session', 'true');

        // Show pop-up modal
        popModal.style.display = 'block';

        // Set up button actions
        document.getElementById('btn-pop-close').onclick = () => {
            popModal.style.display = 'none';
        };

        document.getElementById('btn-pop-view-readings').onclick = () => {
            popModal.style.display = 'none';
            // Switch to readings tab
            const readingsTabBtn = document.querySelector('[data-tab="readings"]');
            if (readingsTabBtn) {
                readingsTabBtn.click();
            }
        };
    }
}

// Web Audio API Technical Siren Alarm
function playTechnicalAlertSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (freq, duration, startTime) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.12, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        
        const now = audioCtx.currentTime;
        playBeep(880, 0.12, now);
        playBeep(1046.50, 0.12, now + 0.15);
        playBeep(1318.51, 0.25, now + 0.3);
    } catch (e) {
        console.warn("Could not play technical sound:", e);
    }
}

// Render Technical Area Tab
function renderTechnicalAreaTab() {
    const tableBody = document.querySelector('#tickets-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const priorityWeight = { alta: 3, media: 2, baja: 1 };
    const statusWeight = { 'no-visto': 3, 'pendiente-de-solucion': 3, 'visto-no-resuelto': 2, 'sin-solucion': 1, 'visto-resuelto': 0 };

    const sortedTickets = [...(state.tickets || [])].sort((a, b) => {
        const statusDiff = (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0);
        if (statusDiff !== 0) return statusDiff;
        const prioDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (prioDiff !== 0) return prioDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (sortedTickets.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-secondary-light">No hay pedidos de servicio registrados. Haz clic en "Registrar Pedido".</td></tr>`;
        return;
    }

    sortedTickets.forEach(ticket => {
        const dateFmt = ticket.date ? ticket.date.split('-').reverse().join('/') : 'N/A';
        
        let priorityBadge = '';
        if (ticket.priority === 'alta') {
            priorityBadge = `<span class="badge danger" style="font-weight:700;">🔴 Alta Prioridad</span>`;
        } else if (ticket.priority === 'media') {
            priorityBadge = `<span class="badge warning" style="font-weight:700; color:#d97706; background-color:rgba(245,158,11,0.12);">🟡 Media</span>`;
        } else {
            priorityBadge = `<span class="badge success" style="font-weight:700;">🟢 Baja</span>`;
        }

        let statusBadge = '';
        if (ticket.status === 'no-visto') {
            statusBadge = `<span class="badge danger" style="text-transform:uppercase;">No Visto</span>`;
        } else if (ticket.status === 'visto-no-resuelto') {
            statusBadge = `<span class="badge warning" style="text-transform:uppercase;">Visto - No Resuelto</span>`;
        } else if (ticket.status === 'visto-resuelto') {
            statusBadge = `<span class="badge success" style="text-transform:uppercase;">Resuelto</span>`;
        } else if (ticket.status === 'sin-solucion') {
            statusBadge = `<span class="badge bg-secondary text-white" style="text-transform:uppercase; background-color:#6b7280;">Sin Solución</span>`;
        } else {
            statusBadge = `<span class="badge bg-indigo-light text-indigo" style="text-transform:uppercase;">Pendiente Solución</span>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${dateFmt}</strong>
                <span class="text-xs text-secondary-light d-block">${ticket.time || ''}</span>
            </td>
            <td>
                <span class="font-bold-title">${ticket.clientName}</span>
                ${ticket.clientType === 'externo' ? '<span class="badge bg-secondary-light text-secondary d-block mt-0.5" style="width:fit-content; font-size:9px;">Externo</span>' : ''}
            </td>
            <td>
                <span class="text-sm">${ticket.machineDesc}</span>
                ${ticket.machineType === 'externo' ? '<span class="badge bg-secondary-light text-secondary d-block mt-0.5" style="width:fit-content; font-size:9px;">Equipo Ext.</span>' : ''}
            </td>
            <td>
                <strong>${ticket.taskType}</strong>
                <span class="text-xs text-secondary-light d-block" style="max-width:250px; white-space:normal; line-height:1.3; margin-top:2px;">${escapeHTML(ticket.description)}</span>
            </td>
            <td>${priorityBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="flex-actions-row">
                    <button class="btn btn-secondary btn-sm" onclick="editTicketTrigger('${ticket.id}')">Editar / Resolver</button>
                    <button class="btn btn-danger-outline btn-sm" onclick="deleteTicketTrigger('${ticket.id}')">Eliminar</button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Render Active Tickets on Dashboard
function renderDashboardTechnicalTickets() {
    const listEl = document.getElementById('dashboard-tickets-list');
    const rowEl = document.getElementById('dashboard-tickets-row');
    const countBadge = document.getElementById('dashboard-tickets-count-badge');
    if (!listEl || !rowEl) return;

    listEl.innerHTML = '';

    // Active tickets: those NOT in visto-resuelto or sin-solucion
    const activeTickets = (state.tickets || []).filter(t => t.status !== 'visto-resuelto' && t.status !== 'sin-solucion');

    // Sort by priority (high first), then date
    const priorityWeight = { alta: 3, media: 2, baja: 1 };
    activeTickets.sort((a, b) => {
        const prioDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (prioDiff !== 0) return prioDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (activeTickets.length > 0) {
        rowEl.style.display = 'block';
        if (countBadge) countBadge.textContent = `${activeTickets.length} Activos`;

        activeTickets.forEach(ticket => {
            const li = document.createElement('li');
            li.style.padding = '10px 14px';
            li.style.borderRadius = '8px';
            li.style.fontSize = '13px';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.gap = '12px';

            let bg = 'rgba(16, 185, 129, 0.05)';
            let border = '1px solid rgba(16, 185, 129, 0.15)';
            let color = 'var(--emerald)';
            let badgeText = '🟢 Baja';

            if (ticket.priority === 'alta') {
                bg = 'rgba(239, 68, 68, 0.08)';
                border = '1px solid rgba(239, 68, 68, 0.15)';
                color = '#dc2626';
                badgeText = '🔴 Alta';
            } else if (ticket.priority === 'media') {
                bg = 'rgba(245, 158, 11, 0.08)';
                border = '1px solid rgba(245, 158, 11, 0.15)';
                color = '#d97706';
                badgeText = '🟡 Media';
            }

            li.style.backgroundColor = bg;
            li.style.border = border;
            li.style.color = color;

            let statusLabel = '';
            if (ticket.status === 'no-visto') statusLabel = 'NO VISTO';
            else if (ticket.status === 'pendiente-de-solucion') statusLabel = 'PENDIENTE';
            else statusLabel = 'VISTO';

            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge" style="font-weight:700; font-size:10px; padding:2px 6px; background-color:white; border:1px solid currentColor;">${badgeText}</span>
                    <span><strong>${ticket.clientName}</strong> (${ticket.machineDesc}): <span style="color:var(--text-primary); font-weight:500;">[${statusLabel}] ${escapeHTML(ticket.description)}</span></span>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="editTicketTrigger('${ticket.id}')" style="background-color:white; border:1px solid rgba(0,0,0,0.1); color:var(--text-primary); font-size:11px; padding:4px 10px; white-space:nowrap; flex-shrink:0;">
                    Atender
                </button>
            `;
            listEl.appendChild(li);
        });
    } else {
        rowEl.style.display = 'none';
        if (countBadge) countBadge.textContent = '0 Activos';
    }
}

// Modal Form: Add / Edit Technical Ticket
function openTicketModal(ticketId = null) {
    closeAllModals();
    const modal = document.getElementById('modal-ticket');
    const form = document.getElementById('form-ticket');
    form.reset();

    const titleEl = document.getElementById('modal-ticket-title');
    const idInput = document.getElementById('ticket-id');
    const clientSelect = document.getElementById('ticket-client-id');
    const machineSelect = document.getElementById('ticket-machine-id');

    // Populate clients dropdown
    clientSelect.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
    state.clients.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        clientSelect.appendChild(option);
    });

    // Populate technicians dropdown
    const techSelect = document.getElementById('ticket-assigned-tech');
    if (techSelect) {
        techSelect.innerHTML = '<option value="">-- Seleccionar Técnico --</option>';
        const technicians = (state.users || []).filter(u => u.role === 'tecnico');
        technicians.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = `${t.fullname} (${t.phone || 'Sin Celular'})`;
            techSelect.appendChild(option);
        });
    }

    // Helper: update machines dropdown for selected client
    const updateMachinesDropdown = (clientId) => {
        machineSelect.innerHTML = '<option value="">-- Seleccionar Equipo --</option>';
        if (!clientId) return;
        const clientMachines = state.machines.filter(m => m.clientId === clientId);
        clientMachines.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = `${m.brand || ''} ${m.model} (S/N: ${m.serial})`;
            machineSelect.appendChild(option);
        });
    };

    clientSelect.onchange = (e) => {
        updateMachinesDropdown(e.target.value);
    };

    // Client type change handlers
    const clientTypeSelect = document.getElementById('ticket-client-type');
    const groupClientSelect = document.getElementById('group-ticket-client-select');
    const groupExternalClient = document.getElementById('group-ticket-external-client');
    const groupMachineSelect = document.getElementById('group-ticket-machine-select');
    const groupExternalMachine = document.getElementById('group-ticket-external-machine');

    const handleClientTypeChange = () => {
        const type = clientTypeSelect.value;
        if (type === 'existente') {
            groupClientSelect.style.display = 'block';
            groupExternalClient.style.display = 'none';
            groupMachineSelect.style.display = 'block';
            groupExternalMachine.style.display = 'none';
            document.getElementById('ticket-client-id').required = true;
            document.getElementById('ticket-external-client').required = false;
            document.getElementById('ticket-machine-id').required = true;
            document.getElementById('ticket-external-machine').required = false;
        } else {
            groupClientSelect.style.display = 'none';
            groupExternalClient.style.display = 'block';
            groupMachineSelect.style.display = 'none';
            groupExternalMachine.style.display = 'block';
            document.getElementById('ticket-client-id').required = false;
            document.getElementById('ticket-external-client').required = true;
            document.getElementById('ticket-machine-id').required = false;
            document.getElementById('ticket-external-machine').required = true;
        }
    };

    clientTypeSelect.onchange = handleClientTypeChange;

    if (ticketId) {
        titleEl.textContent = 'Editar / Resolver Pedido de Soporte';
        const ticket = state.tickets.find(t => t.id === ticketId);
        if (ticket) {
            idInput.value = ticket.id;
            clientTypeSelect.value = ticket.clientType;
            handleClientTypeChange();

            if (ticket.clientType === 'existente') {
                clientSelect.value = ticket.clientId || '';
                updateMachinesDropdown(ticket.clientId);
                machineSelect.value = ticket.machineId || '';
            } else {
                document.getElementById('ticket-external-client').value = ticket.clientName || '';
                document.getElementById('ticket-external-machine').value = ticket.machineDesc || '';
            }

            document.getElementById('ticket-task-type').value = ticket.taskType || 'Servicio';
            document.getElementById('ticket-priority').value = ticket.priority || 'baja';
            document.getElementById('ticket-status').value = ticket.status || 'no-visto';
            document.getElementById('ticket-description').value = ticket.description || '';
            document.getElementById('ticket-diagnostic').value = ticket.diagnostic || '';
            document.getElementById('ticket-action-taken').value = ticket.actionTaken || '';
            document.getElementById('ticket-assigned-tech').value = ticket.assignedTechId || '';
        }
    } else {
        titleEl.textContent = 'Registrar Pedido de Servicio';
        idInput.value = '';
        clientTypeSelect.value = 'existente';
        handleClientTypeChange();
        document.getElementById('ticket-status').value = 'no-visto';
        document.getElementById('ticket-priority').value = 'baja';
        document.getElementById('ticket-assigned-tech').value = '';
    }

    modal.style.display = 'block';
}

async function saveTicket() {
    const id = document.getElementById('ticket-id').value;
    const clientType = document.getElementById('ticket-client-type').value;
    const priority = document.getElementById('ticket-priority').value;
    const taskType = document.getElementById('ticket-task-type').value;
    const status = document.getElementById('ticket-status').value;
    const description = document.getElementById('ticket-description').value;
    const diagnostic = document.getElementById('ticket-diagnostic').value;
    const actionTaken = document.getElementById('ticket-action-taken').value;

    let clientId = '';
    let clientName = '';
    let machineId = '';
    let machineDesc = '';

    if (clientType === 'existente') {
        clientId = document.getElementById('ticket-client-id').value;
        const client = state.clients.find(c => c.id === clientId);
        clientName = client ? client.name : 'Cliente no encontrado';

        machineId = document.getElementById('ticket-machine-id').value;
        const machine = state.machines.find(m => m.id === machineId);
        machineDesc = machine ? `${machine.brand || ''} ${machine.model} (${machine.serial})` : 'Copiadora no encontrada';
    } else {
        clientName = document.getElementById('ticket-external-client').value.trim();
        machineDesc = document.getElementById('ticket-external-machine').value.trim();
    }

    if (!clientName || !machineDesc) {
        showToast('Por favor completa todos los campos del cliente y equipo.', 'error');
        return;
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = today.toTimeString().split(' ')[0].substring(0, 5);

    const assignedTechId = document.getElementById('ticket-assigned-tech').value;

    const ticketData = {
        id: id || ('tick-' + Date.now()),
        clientType,
        clientId,
        clientName,
        machineId,
        machineDesc,
        taskType,
        priority,
        status,
        description,
        diagnostic,
        actionTaken,
        assignedTechId,
        date: id ? (state.tickets.find(t => t.id === id)?.date || dateStr) : dateStr,
        time: id ? (state.tickets.find(t => t.id === id)?.time || timeStr) : timeStr,
        createdAt: id ? (state.tickets.find(t => t.id === id)?.createdAt || Date.now()) : Date.now()
    };

    if (id) {
        const idx = state.tickets.findIndex(t => t.id === id);
        if (idx !== -1) {
            state.tickets[idx] = ticketData;
            showToast('Pedido de servicio modificado', 'success');
        }
    } else {
        state.tickets.push(ticketData);
        playTechnicalAlertSound();
        showToast('Pedido de servicio registrado con éxito', 'success');
    }

    // Auto-log to machine maintenance history if actionTaken is provided and clientType is "existente"
    if (clientType === 'existente' && machineId && actionTaken.trim()) {
        const currentCounter = getLatestCounterForMachine(machineId) || 0;
        const maintEntry = state.maintenance.find(e => e.ticketId === ticketData.id);
        
        const newMaint = {
            id: maintEntry ? maintEntry.id : ('maint-' + Date.now()),
            machineId: machineId,
            date: dateStr,
            type: taskType === 'Insumo' ? 'Insumo' : (taskType === 'Repuesto' ? 'Repuesto' : 'Servicio'),
            description: `Área Técnica (Ticket #${ticketData.id.split('-')[1] || ''}): ${diagnostic.trim() ? diagnostic + ' - ' : ''}${actionTaken}`,
            counter: currentCounter,
            ticketId: ticketData.id
        };

        if (maintEntry) {
            const idx = state.maintenance.findIndex(e => e.id === maintEntry.id);
            if (idx !== -1) state.maintenance[idx] = newMaint;
        } else {
            state.maintenance.push(newMaint);
        }
        dbSet('maintenance', newMaint.id, newMaint);
    }

    dbSet('tickets', ticketData.id, ticketData);
    closeAllModals();
    renderApp();

    // Trigger WhatsApp notification to the assigned technician if select has target with phone
    if (assignedTechId) {
        const tech = state.users.find(u => u.id === assignedTechId);
        if (tech && tech.phone) {
            setTimeout(() => {
                const sendConfirm = confirm(`¿Deseas enviar el aviso de WhatsApp al técnico asignado (${tech.fullname})?`);
                if (sendConfirm) {
                    const cleanPhone = tech.phone.replace(/\D/g, ''); // Clean non-digits
                    const formattedMsg = `⚠️ *AVISO DE SOPORTE - M&S* ⚠️\n\n` +
                                         `*Fecha:* ${dateStr.split('-').reverse().join('/')} ${timeStr}\n` +
                                         `*Cliente:* ${clientName}\n` +
                                         `*Equipo:* ${machineDesc}\n` +
                                         `*Prioridad:* ${priority.toUpperCase()}\n` +
                                         `*Tarea:* ${taskType}\n` +
                                         `*Problema:* ${description}\n` +
                                         `*Estado:* ${status.toUpperCase()}\n` +
                                         (actionTaken.trim() ? `*Resolución:* ${actionTaken}\n` : '') +
                                         `\n🌐 Acceder al sistema:\nhttps://dashboard-mys.netlify.app/`;
                    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedMsg)}`;
                    window.open(waUrl, '_blank');
                }
            }, 300);
        }
    }
}

window.editTicketTrigger = (ticketId) => {
    openTicketModal(ticketId);
};

window.deleteTicketTrigger = (ticketId) => {
    if (confirm('¿Estás seguro de que deseas eliminar permanentemente este pedido de servicio técnico?')) {
        state.tickets = state.tickets.filter(t => t.id !== ticketId);
        dbDelete('tickets', ticketId);
        showToast('Pedido eliminado de la base de datos', 'warning');
        renderTechnicalAreaTab();
    }
};

// REPORTING SYSTEM FOR CLIENTS AND MACHINES
let activeReport = { type: null, id: null };

function generateClientReportPlainText(client) {
    const assignedMachines = state.machines.filter(m => m.clientId === client.id);
    const clientReadings = state.readings.filter(r => r.clientId === client.id);
    clientReadings.sort((a, b) => (a.month || '').localeCompare(b.month || ''));

    // Impositivos & Accounting
    let totalNetoGravado = 0;
    let totalIva21 = 0;
    let totalIva105 = 0;
    let totalCredito = 0;
    let totalDebito = 0;
    let totalNoOficial = 0;
    let totalCobrado = 0;

    let pendingListStr = "";
    const pendingReadings = clientReadings.filter(r => r.status === 'pending');

    clientReadings.forEach(r => {
        const m = state.machines.find(mac => mac.id === r.machineId);
        const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
        const isUnofficial = r.isUnofficial || false;
        const creditNote = r.creditNote || 0;
        const debitNote = r.debitNote || 0;

        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (!isUnofficial && m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? exc * abono.excessPrice : 0;
        const net = fixedCost + excessCost;
        const iva = net * (ivaRate / 100);

        if (isUnofficial) {
            totalNoOficial += net;
        } else {
            totalNetoGravado += net;
            if (ivaRate === 21) {
                totalIva21 += iva;
            } else if (ivaRate === 10.5) {
                totalIva105 += iva;
            }
        }

        totalCredito += creditNote;
        totalDebito += debitNote;
        totalCobrado += (r.partialPaid || 0);

        if (r.status === 'pending') {
            const total = net * (1 + ivaRate / 100) - creditNote + debitNote;
            const alreadyPaid = r.partialPaid || 0;
            const remaining = Math.max(0, total - alreadyPaid);
            const mName = m ? `${m.brand} ${m.model}` : 'Desconocido';
            pendingListStr += `• ${formatPeriod(r.month)}: ${mName} - Debe: ${formatCurrency(remaining)}` + (alreadyPaid > 0 ? ` (Abonado: ${formatCurrency(alreadyPaid)})` : '') + `\n`;
        }
    });

    const totalFacturadoOfficial = totalNetoGravado + totalIva21 + totalIva105 - totalCredito + totalDebito;
    const totalFacturadoGeneral = totalFacturadoOfficial + totalNoOficial;
    const saldoAdeudado = Math.max(0, totalFacturadoGeneral - totalCobrado);

    // Ledger Entries Generation
    let ledgerEntries = [];
    clientReadings.forEach(r => {
        const m = state.machines.find(mac => mac.id === r.machineId);
        const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
        const isUnofficial = r.isUnofficial || false;
        const creditNote = r.creditNote || 0;
        const debitNote = r.debitNote || 0;

        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (!isUnofficial && m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? exc * abono.excessPrice : 0;
        const net = fixedCost + excessCost;
        const iva = net * (ivaRate / 100);
        const baseInvoiceAmt = net + iva;

        const invoiceDate = r.month + '-28';
        const machineDesc = m ? `${m.brand} ${m.model} (${m.serial})` : 'Equipo';

        ledgerEntries.push({
            date: invoiceDate,
            concept: `Cargo mensual ${machineDesc}`,
            docType: isUnofficial ? 'Factura No Of.' : 'Factura',
            docNro: r.invoiceNumber || 'Pendiente',
            debe: baseInvoiceAmt,
            haber: 0
        });

        if (creditNote > 0) {
            ledgerEntries.push({
                date: invoiceDate,
                concept: `Nota de Crédito: ${r.creditNoteReason || 'Descuento'}`,
                docType: 'NC',
                docNro: r.invoiceNumber ? `NC-${r.invoiceNumber.split('-')[1] || r.invoiceNumber}` : 'S/N',
                debe: 0,
                haber: creditNote
            });
        }

        if (debitNote > 0) {
            ledgerEntries.push({
                date: invoiceDate,
                concept: `Nota de Débito: ${r.debitNoteReason || 'Recargo'}`,
                docType: 'ND',
                docNro: r.invoiceNumber ? `ND-${r.invoiceNumber.split('-')[1] || r.invoiceNumber}` : 'S/N',
                debe: debitNote,
                haber: 0
            });
        }

        const alreadyPaid = r.partialPaid || 0;
        if (alreadyPaid > 0) {
            let payMethodLabel = r.paymentMethod || 'Efectivo';
            ledgerEntries.push({
                date: r.paymentDate || invoiceDate,
                concept: `Cobro Período ${formatPeriod(r.month)} [${payMethodLabel}]`,
                docType: 'Recibo',
                docNro: r.paymentReference || 'S/N',
                debe: 0,
                haber: alreadyPaid
            });
        }
    });

    ledgerEntries.sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = 0;
    let ledgerStr = "";
    ledgerEntries.forEach(entry => {
        runningBalance += (entry.debe - entry.haber);
        const dateFmt = entry.date.split('-').reverse().join('/');
        ledgerStr += `${dateFmt} | ${entry.docType} [Nº ${entry.docNro}] | ${entry.concept} | Debe: ${entry.debe > 0 ? formatCurrency(entry.debe) : '-'} | Haber: ${entry.haber > 0 ? formatCurrency(entry.haber) : '-'} | Saldo: ${formatCurrency(runningBalance)}\n`;
    });

    // Machines Rented
    let machinesStr = "";
    assignedMachines.forEach(m => {
        const abono = state.abonos.find(a => a.id === m.abonoId);
        machinesStr += `• ${m.brand} ${m.model} (S/N: ${m.serial}) - Plan: ${abono ? abono.name : 'Sin plan'} | Contador: ${(m.machineCounter || 0).toLocaleString('es-AR')}\n`;
    });

    // Maintenance logs
    const clientMachineIds = assignedMachines.map(m => m.id);
    const clientMaintenance = state.maintenance.filter(mn => clientMachineIds.includes(mn.machineId));
    clientMaintenance.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    let maintStr = "";
    clientMaintenance.slice(0, 5).forEach(mn => {
        const m = state.machines.find(mac => mac.id === mn.machineId);
        const mName = m ? `${m.brand} ${m.model}` : 'Equipo';
        const dateFmt = mn.date ? mn.date.split('-').reverse().join('/') : '-';
        maintStr += `• ${dateFmt} - ${mName} (${mn.type}): ${mn.description} | Contador: ${(mn.counter || 0).toLocaleString('es-AR')}\n`;
    });

    let msg = `📊 *ESTADO DE CUENTA CORRIENTE - M&S*\n` +
              `*Cliente:* ${client.name}\n` +
              `*Emisión:* ${new Date().toLocaleDateString('es-AR')}\n\n` +
              `----------------------------------\n` +
              `💰 *RESUMEN CONTABLE*\n` +
              `• Total Facturado (Cargos): ${formatCurrency(totalFacturadoGeneral)}\n` +
              `• Total Cobrado (Abonos): ${formatCurrency(totalCobrado)}\n` +
              `*• SALDO ACTUAL PENDIENTE: ${formatCurrency(saldoAdeudado)}*\n\n` +
              `----------------------------------\n` +
              `⚖️ *DESGLOSE FISCAL E IVA*\n` +
              `• Neto Gravado (Oficial): ${formatCurrency(totalNetoGravado)}\n` +
              `• Débito IVA Facturado: ${formatCurrency(totalIva21 + totalIva105)}\n` +
              `• Notas de Crédito (Desc.): -${formatCurrency(totalCredito)}\n` +
              `• Notas de Débito (Rec.): +${formatCurrency(totalDebito)}\n` +
              `• Operaciones No Oficiales: ${formatCurrency(totalNoOficial)}\n` +
              `----------------------------------\n\n` +
              (pendingListStr ? `*⚠️ COMPROBANTES IMPAGOS:*\n${pendingListStr}\n` : `🎉 *Estado Financiero:* Al Día / Sin Deudas.\n\n`) +
              `----------------------------------\n` +
              `📖 *MOVIMIENTOS (LIBRO MAYOR)*\n` +
              `Fecha | Comprobante | Concepto | Debe | Haber | Saldo\n` +
              (ledgerStr || 'Sin movimientos registrados.\n') +
              `\n----------------------------------\n` +
              `🖨️ *EQUIPOS EN ALQUILER (${assignedMachines.length})*\n` +
              (machinesStr || 'Sin equipos asignados.\n') +
              `\n----------------------------------\n` +
              `🌐 *Acceso a la plataforma:*\nhttps://dashboard-mys.netlify.app/`;
    return msg;
}

function generateMachineReportPlainText(machine) {
    const client = state.clients.find(c => c.id === machine.clientId);
    const abono = state.abonos.find(a => a.id === machine.abonoId);
    const abonoName = abono ? abono.name : 'Sin plan';

    // Readings for this machine
    const machineReadings = state.readings.filter(r => r.machineId === machine.id);
    machineReadings.sort((a, b) => (b.month || '').localeCompare(a.month || ''));

    let readingsStr = "";
    machineReadings.forEach(r => {
        const diff = Math.max(0, r.final - r.initial);
        const statusLabel = r.status === 'paid' ? 'Cobrado' : 'Pendiente';
        readingsStr += `• Período ${formatPeriod(r.month)}: Cont. ${r.initial.toLocaleString('es-AR')} a ${r.final.toLocaleString('es-AR')} | Consumo: ${diff.toLocaleString('es-AR')} | Estado: ${statusLabel}\n`;
    });

    // Maintenance logs for this machine
    const machineMaintenance = state.maintenance.filter(mn => mn.machineId === machine.id);
    machineMaintenance.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let maintStr = "";
    machineMaintenance.forEach(mn => {
        const dateFmt = mn.date ? mn.date.split('-').reverse().join('/') : '-';
        maintStr += `• ${dateFmt} (${mn.type}): ${mn.description} | Contador: ${(mn.counter || 0).toLocaleString('es-AR')}\n`;
    });

    let msg = `📊 *REPORTE TÉCNICO DE EQUIPO - M&S*\n` +
              `*Equipo:* ${machine.brand} ${machine.model}\n` +
              `*Número de Serie:* ${machine.serial}\n` +
              `*Contador Actual:* ${(machine.machineCounter || 0).toLocaleString('es-AR')} copias\n` +
              `*Cliente Asignado:* ${client ? client.name : 'Disponible en Stock'}\n` +
              `*Plan Asignado:* ${abonoName}\n` +
              `*Fecha Emisión:* ${new Date().toLocaleDateString('es-AR')}\n\n` +
              `----------------------------------\n` +
              `📈 *HISTORIAL DE LECTURAS Y CONSUMOS*\n` +
              (readingsStr || 'No se registran lecturas para este equipo.\n') +
              `\n----------------------------------\n` +
              `🔧 *BITÁCORA TÉCNICA Y REPUESTOS (${machineMaintenance.length})*\n` +
              (maintStr || 'No se registran reparaciones técnicas para este equipo.\n') +
              `\n----------------------------------\n` +
              `🌐 Acceder a la plataforma:\nhttps://dashboard-mys.netlify.app/`;
    return msg;
}

function setupReports() {
    // Print button
    const printBtn = document.getElementById('btn-report-print');
    if (printBtn) {
        printBtn.onclick = () => {
            window.print();
        };
    }

    // WhatsApp share button
    const waBtn = document.getElementById('btn-report-whatsapp');
    if (waBtn) {
        waBtn.onclick = () => {
            let msg = "";
            if (activeReport.type === 'client') {
                const client = state.clients.find(c => c.id === activeReport.id);
                if (!client) return;
                msg = generateClientReportPlainText(client);
            } else if (activeReport.type === 'machine') {
                const machine = state.machines.find(m => m.id === activeReport.id);
                if (!machine) return;
                msg = generateMachineReportPlainText(machine);
            }
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
        };
    }

    // Email share button
    const emailBtn = document.getElementById('btn-report-email');
    if (emailBtn) {
        emailBtn.onclick = () => {
            let subject = "";
            let body = "";
            if (activeReport.type === 'client') {
                const client = state.clients.find(c => c.id === activeReport.id);
                if (!client) return;
                subject = `Reporte Consolidado de Cliente - ${client.name}`;
                body = generateClientReportPlainText(client);
            } else if (activeReport.type === 'machine') {
                const machine = state.machines.find(m => m.id === activeReport.id);
                if (!machine) return;
                subject = `Reporte Técnico de Equipo - S/N ${machine.serial}`;
                body = generateMachineReportPlainText(machine);
            }
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
        };
    }

    // Excel export button
    const excelBtn = document.getElementById('btn-report-excel');
    if (excelBtn) {
        excelBtn.onclick = () => {
            if (activeReport.type === 'client') {
                const client = state.clients.find(c => c.id === activeReport.id);
                if (client) exportClientToCsv(client);
            } else if (activeReport.type === 'machine') {
                const machine = state.machines.find(m => m.id === activeReport.id);
                if (machine) exportMachineToCsv(machine);
            }
        };
    }
}

function generateClientReportHtml(client) {
    const assignedMachines = state.machines.filter(m => m.clientId === client.id);
    const machinesTableRows = assignedMachines.map(m => {
        const abono = state.abonos.find(a => a.id === m.abonoId);
        const abonoName = abono ? abono.name : 'Sin abono';
        return `
            <tr>
                <td><strong>${m.brand} ${m.model}</strong></td>
                <td><code>${m.serial}</code></td>
                <td>${m.type}</td>
                <td>${abonoName}</td>
                <td>${m.installationDate ? m.installationDate.split('-').reverse().join('/') : '-'}</td>
                <td style="text-align:right;"><strong>${(m.machineCounter || 0).toLocaleString('es-AR')}</strong></td>
            </tr>
        `;
    }).join('');

    // Readings for all client machines (historical and active)
    const clientReadings = state.readings.filter(r => r.clientId === client.id);
    clientReadings.sort((a, b) => (a.month || '').localeCompare(b.month || ''));

    // Accounting and Impositivos Accumulators
    let totalNetoGravado = 0;
    let totalIva21 = 0;
    let totalIva105 = 0;
    let totalCredito = 0;
    let totalDebito = 0;
    let totalNoOficial = 0;
    let totalCobrado = 0;

    // Detailed pending elements helper
    let pendingDetailsHtml = "";
    const pendingReadings = clientReadings.filter(r => r.status === 'pending');

    clientReadings.forEach(r => {
        const m = state.machines.find(mac => mac.id === r.machineId);
        const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
        const isUnofficial = r.isUnofficial || false;
        const creditNote = r.creditNote || 0;
        const debitNote = r.debitNote || 0;

        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (!isUnofficial && m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? exc * abono.excessPrice : 0;
        const net = fixedCost + excessCost;
        const iva = net * (ivaRate / 100);

        if (isUnofficial) {
            totalNoOficial += net;
        } else {
            totalNetoGravado += net;
            if (ivaRate === 21) {
                totalIva21 += iva;
            } else if (ivaRate === 10.5) {
                totalIva105 += iva;
            }
        }

        totalCredito += creditNote;
        totalDebito += debitNote;
        totalCobrado += (r.partialPaid || 0);

        // For pending list in status card
        if (r.status === 'pending') {
            const total = net * (1 + ivaRate / 100) - creditNote + debitNote;
            const alreadyPaid = r.partialPaid || 0;
            const remaining = Math.max(0, total - alreadyPaid);
            const mName = m ? `${m.brand} ${m.model}` : 'Desconocido';
            const partialLabel = alreadyPaid > 0 ? `<br><span style="font-size:9px; color:var(--text-secondary-light);">Abonado parcial: ${formatCurrency(alreadyPaid)}</span>` : '';
            pendingDetailsHtml += `
                <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dashed rgba(239, 68, 68, 0.1); font-size:11px;">
                    <span>• <strong>${formatPeriod(r.month)}</strong> - ${mName}${partialLabel}</span>
                    <span style="color:#dc2626; font-weight:700;">${formatCurrency(remaining)}</span>
                </div>
            `;
        }
    });

    if (pendingReadings.length === 0) {
        pendingDetailsHtml = `<div style="font-size:11px; color:var(--emerald); font-weight:600; padding:4px 0;">🎉 El cliente no posee saldo deudor.</div>`;
    }

    const totalFacturadoOfficial = totalNetoGravado + totalIva21 + totalIva105 - totalCredito + totalDebito;
    const totalFacturadoGeneral = totalFacturadoOfficial + totalNoOficial;
    const saldoAdeudado = Math.max(0, totalFacturadoGeneral - totalCobrado);

    // Chronological Ledger Entries Generation
    let ledgerEntries = [];
    clientReadings.forEach(r => {
        const m = state.machines.find(mac => mac.id === r.machineId);
        const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
        const isUnofficial = r.isUnofficial || false;
        const creditNote = r.creditNote || 0;
        const debitNote = r.debitNote || 0;

        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (!isUnofficial && m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? exc * abono.excessPrice : 0;
        const net = fixedCost + excessCost;
        const iva = net * (ivaRate / 100);
        const baseInvoiceAmt = net + iva;

        // Date represents the end of the billing month for invoices
        const invoiceDate = r.month + '-28';
        const machineDesc = m ? `${m.brand} ${m.model} (${m.serial})` : 'Equipo';

        // 1. Debit charge (Debe)
        ledgerEntries.push({
            date: invoiceDate,
            concept: `Cargo Alquiler mensual ${machineDesc} - Período ${formatPeriod(r.month)}`,
            docType: isUnofficial ? 'Factura No Oficial' : 'Factura',
            docNro: r.invoiceNumber || 'Pendiente',
            debe: baseInvoiceAmt,
            haber: 0
        });

        // 2. Nota de Crédito (Haber)
        if (creditNote > 0) {
            ledgerEntries.push({
                date: invoiceDate,
                concept: `Nota de Crédito: ${r.creditNoteReason || 'Bonificación / Descuento'}`,
                docType: 'Nota de Crédito',
                docNro: r.invoiceNumber ? `NC-${r.invoiceNumber.split('-')[1] || r.invoiceNumber}` : 'S/N',
                debe: 0,
                haber: creditNote
            });
        }

        // 3. Nota de Débito (Debe)
        if (debitNote > 0) {
            ledgerEntries.push({
                date: invoiceDate,
                concept: `Nota de Débito: ${r.debitNoteReason || 'Recargo contable'}`,
                docType: 'Nota de Débito',
                docNro: r.invoiceNumber ? `ND-${r.invoiceNumber.split('-')[1] || r.invoiceNumber}` : 'S/N',
                debe: debitNote,
                haber: 0
            });
        }

        // 4. Payments received (Haber)
        const alreadyPaid = r.partialPaid || 0;
        if (alreadyPaid > 0) {
            let payMethodLabel = r.paymentMethod || 'Efectivo';
            if (r.paymentReference) {
                payMethodLabel += ` [Ref: ${r.paymentReference}]`;
            }
            ledgerEntries.push({
                date: r.paymentDate || invoiceDate,
                concept: `Cobro Alquiler Período ${formatPeriod(r.month)} - Medio: ${payMethodLabel}`,
                docType: 'Recibo',
                docNro: r.paymentReference || 'S/N',
                debe: 0,
                haber: alreadyPaid
            });
        }
    });

    // Sort ledger items chronologically (oldest first)
    ledgerEntries.sort((a, b) => a.date.localeCompare(b.date));

    // Render ledger table rows with cumulative running balance calculation
    let runningBalance = 0;
    const ledgerTableRows = ledgerEntries.map(entry => {
        runningBalance += (entry.debe - entry.haber);
        
        let typeBadge = "";
        if (entry.docType === 'Factura') {
            typeBadge = `<span class="badge" style="font-size:9px; padding:1px 4px; background-color:rgba(99,102,241,0.08); color:var(--indigo); border:1px solid rgba(99,102,241,0.15);">Factura</span>`;
        } else if (entry.docType === 'Factura No Oficial') {
            typeBadge = `<span class="badge" style="font-size:9px; padding:1px 4px; background-color:rgba(17,24,39,0.08); color:var(--text-secondary); border:1px solid rgba(17,24,39,0.15);">Factura No Of.</span>`;
        } else if (entry.docType === 'Nota de Crédito') {
            typeBadge = `<span class="badge success" style="font-size:9px; padding:1px 4px;">N. Crédito</span>`;
        } else if (entry.docType === 'Nota de Débito') {
            typeBadge = `<span class="badge danger" style="font-size:9px; padding:1px 4px;">N. Débito</span>`;
        } else if (entry.docType === 'Recibo') {
            typeBadge = `<span class="badge success" style="font-size:9px; padding:1px 4px; background-color:rgba(16,185,129,0.08); color:var(--emerald); border:none;">Recibo</span>`;
        }

        return `
            <tr>
                <td><strong>${entry.date.split('-').reverse().join('/')}</strong></td>
                <td>${typeBadge}</td>
                <td><code>${entry.docNro}</code></td>
                <td class="font-bold-title">${entry.concept}</td>
                <td style="text-align:right; font-weight:600; color:${entry.debe > 0 ? 'var(--text-primary)' : 'var(--text-secondary-light)'};">${entry.debe > 0 ? formatCurrency(entry.debe) : '-'}</td>
                <td style="text-align:right; font-weight:600; color:${entry.haber > 0 ? 'var(--emerald)' : 'var(--text-secondary-light)'};">${entry.haber > 0 ? formatCurrency(entry.haber) : '-'}</td>
                <td style="text-align:right; font-weight:700; color:${runningBalance > 0 ? '#dc2626' : 'var(--emerald)'};">${formatCurrency(runningBalance)}</td>
            </tr>
        `;
    }).join('');

    // Maintenance logs for all client machines
    const clientMachineIds = assignedMachines.map(m => m.id);
    const clientMaintenance = state.maintenance.filter(mn => clientMachineIds.includes(mn.machineId));
    clientMaintenance.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const maintTableRows = clientMaintenance.map(mn => {
        const m = state.machines.find(mac => mac.id === mn.machineId);
        const mName = m ? `${m.brand} ${m.model}` : 'Desconocido';
        const dateFmt = mn.date ? mn.date.split('-').reverse().join('/') : '-';
        return `
            <tr>
                <td><strong>${dateFmt}</strong></td>
                <td>${mName} (<code>${m ? m.serial : ''}</code>)</td>
                <td><span class="badge ${mn.type === 'Repuesto' ? 'danger' : 'warning'}" style="font-size:10px; padding:1px 4px;">${mn.type}</span></td>
                <td>${mn.description}</td>
                <td style="text-align:right;"><strong>${(mn.counter || 0).toLocaleString('es-AR')}</strong></td>
            </tr>
        `;
    }).join('');

    return `
        <div style="margin-bottom: 20px; display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:15px; width:100%;">
            <!-- Card 1: Datos Generales -->
            <div style="background: rgba(0,0,0,0.015); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; box-sizing:border-box;">
                <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:700; color:var(--indigo); border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom:5px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Datos del Cliente</h4>
                <div style="display:grid; grid-template-columns: 1fr; gap: 8px; font-size:12px;">
                    <div><strong>Razón Social:</strong> ${client.name}</div>
                    <div><strong>Teléfono:</strong> ${client.phone || '-'}</div>
                    <div><strong>Email:</strong> ${client.email || '-'}</div>
                    <div><strong>Dirección:</strong> ${client.address || '-'}</div>
                </div>
                ${client.notes ? `<div style="margin-top:10px; font-size:11px; border-top:1px dashed rgba(0,0,0,0.05); padding-top:8px;"><strong>Notas:</strong> <span style="font-style:italic;">${client.notes}</span></div>` : ''}
            </div>

            <!-- Card 2: Resumen Contable (Saldos) -->
            <div style="border: 1px solid ${saldoAdeudado > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}; background: ${saldoAdeudado > 0 ? 'rgba(239, 68, 68, 0.02)' : 'rgba(16, 185, 129, 0.02)'}; border-radius: 8px; padding: 15px; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                <div>
                    <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:700; color:${saldoAdeudado > 0 ? '#dc2626' : 'var(--emerald)'}; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom:5px; text-transform: uppercase; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">
                        <span>💰 Resumen de Cuenta</span>
                        <span class="badge" style="font-size:9px; padding:2px 6px; background-color:${saldoAdeudado > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)'}; color:${saldoAdeudado > 0 ? '#dc2626' : 'var(--emerald)'}; border:none;">${saldoAdeudado > 0 ? 'Saldo Impago' : 'Al Día'}</span>
                    </h4>
                    <div style="font-size:12px; display:grid; grid-template-columns: 1fr 120px; gap:8px;">
                        <span><strong>Total Facturado (Cargos):</strong></span><span style="text-align:right; font-weight:500;">${formatCurrency(totalFacturadoGeneral)}</span>
                        <span><strong>Total Recibido (Abonos):</strong></span><span style="text-align:right; color:var(--emerald); font-weight:600;">+ ${formatCurrency(totalCobrado)}</span>
                    </div>
                </div>
                <div style="margin-top:15px; padding-top:8px; border-top:1px solid rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:12px; color:var(--text-secondary);">SALDO ACTUAL PENDIENTE:</strong>
                    <strong style="font-size:18px; color:${saldoAdeudado > 0 ? '#dc2626' : 'var(--emerald)'};">${formatCurrency(saldoAdeudado)}</strong>
                </div>
                ${saldoAdeudado > 0 ? `
                <div style="margin-top:10px; text-align:right;" class="no-print">
                    <button type="button" class="btn btn-primary btn-sm btn-icon" onclick="openSettleDebtModal('${client.id}')" style="font-size:11px; padding:6px 12px; font-weight:600; width:100%; justify-content:center; border-radius:4px;">
                        💵 Registrar Pago / Saldar
                    </button>
                </div>
                ` : ''}
            </div>

            <!-- Card 3: Desglose de IVA y Ajustes -->
            <div style="background: rgba(0,0,0,0.015); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; box-sizing:border-box;">
                <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:700; color:var(--indigo); border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom:5px; text-transform: uppercase; letter-spacing: 0.5px;">⚖️ Detalle Fiscal e Impositivo</h4>
                <div style="display:grid; grid-template-columns: 1fr 120px; gap: 6px; font-size:11px;">
                    <span>Neto Gravado (Facturado Oficial):</span><span style="text-align:right; font-weight:500;">${formatCurrency(totalNetoGravado)}</span>
                    <span>Débito Fiscal IVA (21% / 10.5%):</span><span style="text-align:right; font-weight:500;">${formatCurrency(totalIva21 + totalIva105)}</span>
                    <span>Notas de Crédito (Descuentos):</span><span style="text-align:right; color:var(--emerald); font-weight:500;">-${formatCurrency(totalCredito)}</span>
                    <span>Notas de Débito (Recargos):</span><span style="text-align:right; color:#dc2626; font-weight:500;">+${formatCurrency(totalDebito)}</span>
                    <span style="border-top:1px dashed rgba(0,0,0,0.05); padding-top:4px;">Operaciones No Oficiales (Negro):</span><span style="text-align:right; border-top:1px dashed rgba(0,0,0,0.05); padding-top:4px; font-weight:500;">${formatCurrency(totalNoOficial)}</span>
                    <span style="border-top:1px solid rgba(0,0,0,0.1); padding-top:6px; font-size:12px; font-weight:700; color:var(--text-primary);">Total Liquidado General:</span><span style="text-align:right; border-top:1px solid rgba(0,0,0,0.1); padding-top:6px; font-size:12px; font-weight:700; color:var(--indigo);">${formatCurrency(totalFacturadoGeneral)}</span>
                </div>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:var(--text-primary);">📊 LIBRO MAYOR DE CUENTA CORRIENTE (MOVIMIENTOS CRONOLÓGICOS)</h4>
            <div class="table-container">
                <table class="table" style="font-size:11px;">
                    <thead>
                        <tr>
                            <th style="width:100px;">Fecha</th>
                            <th style="width:120px;">Tipo Doc</th>
                            <th style="width:130px;">Ref / Doc Nro</th>
                            <th>Concepto</th>
                            <th style="text-align:right; width:120px;">Debe (Cargos)</th>
                            <th style="text-align:right; width:120px;">Haber (Abonos)</th>
                            <th style="text-align:right; width:120px;">Saldo Acumulado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ledgerTableRows || '<tr><td colspan="7" class="text-center py-3 text-secondary-light">No se registran movimientos en la cuenta corriente de este cliente.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:var(--text-primary);">🖨️ EQUIPOS EN ALQUILER (${assignedMachines.length})</h4>
            <div class="table-container">
                <table class="table" style="font-size:11px;">
                    <thead>
                        <tr>
                            <th>Marca y Modelo</th>
                            <th>Nº Serie</th>
                            <th>Tipo</th>
                            <th>Plan Asignado</th>
                            <th>Fecha Inst.</th>
                            <th style="text-align:right;">Contador Actual</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${machinesTableRows || '<tr><td colspan="6" class="text-center py-3 text-secondary-light">El cliente no tiene equipos en alquiler actualmente.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:var(--text-primary);">🔧 BITÁCORA DE SERVICIO TÉCNICO Y REPUESTOS (${clientMaintenance.length})</h4>
            <div class="table-container">
                <table class="table" style="font-size:11px;">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Equipo</th>
                            <th>Tipo</th>
                            <th>Descripción del Trabajo</th>
                            <th style="text-align:right;">Contador</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${maintTableRows || '<tr><td colspan="5" class="text-center py-3 text-secondary-light">No se registran intervenciones técnicas para este cliente.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function generateMachineReportHtml(machine) {
    const client = state.clients.find(c => c.id === machine.clientId);
    const abono = state.abonos.find(a => a.id === machine.abonoId);
    const abonoName = abono ? abono.name : 'Sin plan';

    // Readings for this machine
    const machineReadings = state.readings.filter(r => r.machineId === machine.id);
    machineReadings.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
    const readingsTableRows = machineReadings.map(r => {
        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (machine.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? exc * abono.excessPrice : 0;
        const net = fixedCost + excessCost;
        const total = net * (1 + ivaRate / 100);

        return `
            <tr>
                <td><strong>${formatPeriod(r.month)}</strong></td>
                <td>${(r.initial || 0).toLocaleString('es-AR')} - ${(r.final || 0).toLocaleString('es-AR')}</td>
                <td><strong>${diff.toLocaleString('es-AR')}</strong></td>
                <td style="text-align:right;"><strong class="text-indigo">${formatCurrency(total)}</strong></td>
            </tr>
        `;
    }).join('');

    // Maintenance log for this machine
    const machineMaintenance = state.maintenance.filter(mn => mn.machineId === machine.id);
    machineMaintenance.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const maintTableRows = machineMaintenance.map(mn => {
        const dateFmt = mn.date ? mn.date.split('-').reverse().join('/') : '-';
        return `
            <tr>
                <td><strong>${dateFmt}</strong></td>
                <td><span class="badge ${mn.type === 'Repuesto' ? 'danger' : 'warning'}" style="font-size:10px; padding:1px 4px;">${mn.type}</span></td>
                <td>${mn.description}</td>
                <td style="text-align:right;"><strong>${(mn.counter || 0).toLocaleString('es-AR')}</strong></td>
            </tr>
        `;
    }).join('');

    return `
        <div style="margin-bottom: 20px; background: rgba(0,0,0,0.015); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px;">
            <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:var(--indigo); border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom:5px;">📋 ESPECIFICACIONES TÉCNICAS DEL EQUIPO</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size:12px;">
                <div><strong>Modelo:</strong> ${machine.brand || ''} ${machine.model || ''}</div>
                <div><strong>Nº de Serie:</strong> <code>${machine.serial}</code></div>
                <div><strong>Tipo:</strong> ${machine.type}</div>
                <div><strong>Estado Físico:</strong> ${machine.status}</div>
                <div><strong>Disponibilidad:</strong> ${machine.isAvailable !== false ? 'Apto Alquiler/Venta' : 'No Disponible'}</div>
                <div><strong>Contador Total:</strong> <strong>${(machine.machineCounter || 0).toLocaleString('es-AR')}</strong> copias</div>
            </div>
        </div>

        <div style="margin-bottom: 20px; background: rgba(0,0,0,0.015); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px;">
            <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:var(--primary); border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom:5px;">👥 ALQUILER VIGENTE Y CLIENTE</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size:12px;">
                <div><strong>Cliente Asignado:</strong> ${client ? client.name : '<em>Sin cliente (Disponible)</em>'}</div>
                <div><strong>Plan Tarifario:</strong> ${abonoName}</div>
                <div><strong>Fecha Instalación:</strong> ${machine.installationDate ? machine.installationDate.split('-').reverse().join('/') : '-'}</div>
                <div><strong>Contador Inicial:</strong> ${machine.initialCounter ? machine.initialCounter.toLocaleString('es-AR') : '0'} copias</div>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:var(--text-primary);">📊 HISTORIAL DE LECTURAS MENSUALES (${machineReadings.length})</h4>
            <div class="table-container">
                <table class="table" style="font-size:11px;">
                    <thead>
                        <tr>
                            <th>Período</th>
                            <th>Rango Contadores</th>
                            <th>Copias Consumidas</th>
                            <th style="text-align:right;">Monto Cobrado (c/IVA)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${readingsTableRows || '<tr><td colspan="4" class="text-center py-3 text-secondary-light">No hay lecturas registradas para esta máquina.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:700; color:var(--text-primary);">🔧 BITÁCORA TÉCNICA E INTERVENCIONES (${machineMaintenance.length})</h4>
            <div class="table-container">
                <table class="table" style="font-size:11px;">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo Servicio</th>
                            <th>Descripción del Trabajo</th>
                            <th style="text-align:right;">Contador en Servicio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${maintTableRows || '<tr><td colspan="4" class="text-center py-3 text-secondary-light">No se registran intervenciones técnicas para esta máquina.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function downloadCsvFile(content, filename) {
    const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportClientToCsv(client) {
    const assignedMachines = state.machines.filter(m => m.clientId === client.id);
    const clientMachineIds = assignedMachines.map(m => m.id);
    const clientReadings = state.readings.filter(r => r.clientId === client.id);
    const clientMaintenance = state.maintenance.filter(mn => clientMachineIds.includes(mn.machineId));

    let csvContent = "";
    csvContent += `REPORTE CONSOLIDADO DE CLIENTE\n`;
    csvContent += `Cliente;${client.name}\n`;
    csvContent += `Telefono;${client.phone || '-'}\n`;
    csvContent += `Email;${client.email || '-'}\n`;
    csvContent += `Direccion;${client.address || '-'}\n\n`;

    csvContent += `EQUIPOS EN ALQUILER\n`;
    csvContent += `Modelo;N Serie;Tipo;Plan;Fecha Inst;Contador Actual\n`;
    assignedMachines.forEach(m => {
        const abono = state.abonos.find(a => a.id === m.abonoId);
        csvContent += `"${m.brand} ${m.model}";"${m.serial}";"${m.type}";"${abono ? abono.name : ''}";"${m.installationDate || ''}";${m.machineCounter || 0}\n`;
    });
    csvContent += `\n`;

    csvContent += `HISTORIAL DE LECTURAS Y FACTURACION\n`;
    csvContent += `Periodo;Equipo;N Serie;Rango Contadores;Consumo;Monto Total;Factura Nro;Nota Credito;Nota Debito;Es Oficial;Estado Pago;Metodo Pago;Ref Pago;Conciliado\n`;
    clientReadings.forEach(r => {
        const m = state.machines.find(mac => mac.id === r.machineId);
        const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
        
        const isUnofficial = r.isUnofficial || false;
        const creditNote = r.creditNote || 0;
        const debitNote = r.debitNote || 0;

        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (!isUnofficial && m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const net = (abono ? abono.price : 0) + (abono ? exc * abono.excessPrice : 0);
        const total = net * (1 + ivaRate / 100) - creditNote + debitNote;
        
        const statusLabel = r.status === 'paid' ? 'Cobrado' : ((r.partialPaid || 0) > 0 ? `Parcial (${r.partialPaid})` : 'Pendiente');
        const concLabel = isUnofficial ? 'Exento' : (r.bankReconciled ? 'Conciliado' : 'Pendiente');

        csvContent += `"${r.month}";"${m ? m.brand + ' ' + m.model : ''}";"${m ? m.serial : ''}";"${r.initial}-${r.final}";${diff};${total.toFixed(2)};"${r.invoiceNumber || ''}";${creditNote};${debitNote};"${isUnofficial ? 'No (Negro)' : 'Si'}";"${statusLabel}";"${r.paymentMethod || ''}";"${r.paymentReference || ''}";"${concLabel}"\n`;
    });
    csvContent += `\n`;

    csvContent += `BITACORA DE SOPORTE TECNICO\n`;
    csvContent += `Fecha;Equipo;Tipo;Trabajo Realizado;Contador\n`;
    clientMaintenance.forEach(mn => {
        const m = state.machines.find(mac => mac.id === mn.machineId);
        csvContent += `"${mn.date}";"${m ? m.brand + ' ' + m.model : ''}";"${mn.type}";"${mn.description}";${mn.counter}\n`;
    });

    downloadCsvFile(csvContent, `Reporte_Cliente_${client.name.replace(/\s+/g, '_')}.csv`);
}

function exportMachineToCsv(machine) {
    const client = state.clients.find(c => c.id === machine.clientId);
    const abono = state.abonos.find(a => a.id === machine.abonoId);
    const machineReadings = state.readings.filter(r => r.machineId === machine.id);
    const machineMaintenance = state.maintenance.filter(mn => mn.machineId === machine.id);

    let csvContent = "";
    csvContent += `REPORTE CONSOLIDADO DE EQUIPO\n`;
    csvContent += `Modelo;${machine.brand} ${machine.model}\n`;
    csvContent += `N Serie;${machine.serial}\n`;
    csvContent += `Tipo;${machine.type}\n`;
    csvContent += `Estado;${machine.status}\n`;
    csvContent += `Contador Total;${machine.machineCounter || 0}\n`;
    csvContent += `Cliente;${client ? client.name : 'Disponible'}\n`;
    csvContent += `Plan;${abono ? abono.name : 'Sin plan'}\n\n`;

    csvContent += `HISTORIAL DE LECTURAS MENSUALES\n`;
    csvContent += `Periodo;Rango Contadores;Consumo;Monto Facturado\n`;
    machineReadings.forEach(r => {
        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (machine.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const net = (abono ? abono.price : 0) + (abono ? exc * abono.excessPrice : 0);
        const total = net * (1 + ivaRate / 100);
        csvContent += `"${r.month}";"${r.initial}-${r.final}";${diff};${total.toFixed(2)}\n`;
    });
    csvContent += `\n`;

    csvContent += `BITACORA TECNICA E INTERVENCIONES\n`;
    csvContent += `Fecha;Tipo Servicio;Trabajo Realizado;Contador en Servicio\n`;
    machineMaintenance.forEach(mn => {
        csvContent += `"${mn.date}";"${mn.type}";"${mn.description}";${mn.counter}\n`;
    });

    downloadCsvFile(csvContent, `Reporte_Equipo_${machine.serial}.csv`);
}

window.openClientReportTrigger = (clientId) => {
    closeAllModals();
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    activeReport = { type: 'client', id: clientId };

    document.getElementById('modal-report-title').textContent = `Reporte de Historial - Cliente: ${client.name}`;
    document.getElementById('report-doc-type').textContent = `HISTORIAL CONSOLIDADO DE CLIENTE`;
    document.getElementById('report-doc-date').textContent = `Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')}`;
    
    const html = generateClientReportHtml(client);
    document.getElementById('report-dynamic-content').innerHTML = html;

    document.getElementById('modal-report').style.display = 'block';
};

window.openMachineReportTrigger = (machineId) => {
    closeAllModals();
    const machine = state.machines.find(m => m.id === machineId);
    if (!machine) return;

    activeReport = { type: 'machine', id: machineId };

    document.getElementById('modal-report-title').textContent = `Reporte de Historial - Equipo: ${machine.brand || ''} ${machine.model} (${machine.serial})`;
    document.getElementById('report-doc-type').textContent = `HISTORIAL CONSOLIDADO DE EQUIPO`;
    document.getElementById('report-doc-date').textContent = `Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')}`;
    
    const html = generateMachineReportHtml(machine);
    document.getElementById('report-dynamic-content').innerHTML = html;

    document.getElementById('modal-report').style.display = 'block';
};

// RENTAL TRANSITIONS: END RENTAL & CHANGE MACHINE
function setupRentalTransitions() {
    const endForm = document.getElementById('form-end-rental');
    if (endForm) {
        endForm.addEventListener('submit', submitEndRental);
    }

    const changeForm = document.getElementById('form-change-machine');
    if (changeForm) {
        changeForm.addEventListener('submit', submitChangeMachine);
    }
}

window.openEndRentalModal = (machineId) => {
    closeAllModals();
    const machine = state.machines.find(m => m.id === machineId);
    if (!machine) return;

    document.getElementById('end-rental-machine-id').value = machineId;
    document.getElementById('end-rental-machine-desc').textContent = `${machine.brand || ''} ${machine.model} (S/N: ${machine.serial})`;
    
    const counterInput = document.getElementById('end-rental-counter');
    counterInput.value = machine.machineCounter || 0;
    counterInput.min = machine.machineCounter || 0;
    
    document.getElementById('end-rental-min-hint').textContent = `El contador actual es de ${(machine.machineCounter || 0).toLocaleString('es-AR')} copias.`;
    
    // Default physical status select to current machine status
    document.getElementById('end-rental-status').value = machine.status === 'Nuevo' ? 'Usado' : (machine.status || 'Usado');
    document.getElementById('end-rental-availability').value = 'true';

    document.getElementById('modal-end-rental').style.display = 'block';
};

async function submitEndRental(e) {
    e.preventDefault();
    const machineId = document.getElementById('end-rental-machine-id').value;
    const finalCounter = parseInt(document.getElementById('end-rental-counter').value, 10) || 0;
    const status = document.getElementById('end-rental-status').value;
    const isAvailable = document.getElementById('end-rental-availability').value === 'true';

    const machine = state.machines.find(m => m.id === machineId);
    if (!machine) return;

    if (finalCounter < (machine.machineCounter || 0)) {
        showToast('El contador final no puede ser menor al contador actual', 'error');
        return;
    }

    // Auto-convert Nuevo to Usado if counter changes from 0 to > 0
    let finalStatus = status;
    if (machine.status === 'Nuevo' && finalCounter > 0) {
        finalStatus = 'Usado';
        showToast('El equipo era Nuevo y al tener contador mayor a 0, cambió a Usado automáticamente', 'info');
    }

    // Save final reading if we want to log the usage for the current month
    const activeReading = state.readings.find(r => r.machineId === machineId && r.month === currentMonth);
    if (activeReading) {
        activeReading.final = finalCounter;
        activeReading.status = 'pending'; // keep it pending so client retains the debt until paid
        await dbSet('readings', activeReading.id, activeReading);
    } else if (machine.clientId) {
        const newReading = {
            id: 'read-' + Date.now(),
            machineId: machineId,
            clientId: machine.clientId,
            abonoId: machine.abonoId || '',
            month: currentMonth,
            initial: machine.machineCounter || 0,
            final: finalCounter,
            status: 'pending' // keep it pending so client retains the debt until paid
        };
        state.readings.push(newReading);
        await dbSet('readings', newReading.id, newReading);
    }

    // Return machine to stock (unlink client/abono)
    machine.clientId = '';
    machine.abonoId = '';
    machine.machineCounter = finalCounter;
    machine.status = finalStatus;
    machine.isAvailable = isAvailable;
    
    // Clear installation details since it is now unassigned
    machine.installationDate = '';
    machine.initialCounter = 0;

    await dbSet('machines', machineId, machine);

    closeAllModals();
    renderApp();
    showToast('Alquiler finalizado y equipo devuelto al stock', 'success');
}

window.openChangeMachineModal = (oldMachineId) => {
    closeAllModals();
    const oldMachine = state.machines.find(m => m.id === oldMachineId);
    if (!oldMachine) return;

    document.getElementById('change-old-machine-id').value = oldMachineId;
    document.getElementById('change-old-machine-desc').textContent = `${oldMachine.brand || ''} ${oldMachine.model} (S/N: ${oldMachine.serial})`;
    
    const oldCounterInput = document.getElementById('change-old-counter');
    oldCounterInput.value = oldMachine.machineCounter || 0;
    oldCounterInput.min = oldMachine.machineCounter || 0;
    document.getElementById('change-old-min-hint').textContent = `Actual: ${(oldMachine.machineCounter || 0).toLocaleString('es-AR')} copias.`;
    
    // Set default return status to Usado
    document.getElementById('change-old-status').value = oldMachine.status === 'Nuevo' ? 'Usado' : (oldMachine.status || 'Usado');

    // Populate dropdown with available machines
    const newMachineSelect = document.getElementById('change-new-machine-id');
    newMachineSelect.innerHTML = '<option value="">-- Selecciona el equipo de reemplazo --</option>';
    
    const available = state.machines.filter(m => (m.status === 'Disponible' || !m.clientId) && m.id !== oldMachineId);
    available.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = `${m.brand || ''} ${m.model} (${m.serial}) - Contador: ${(m.machineCounter || 0).toLocaleString('es-AR')}`;
        newMachineSelect.appendChild(option);
    });

    // Handle selection change to prefill new initial counter
    newMachineSelect.onchange = (e) => {
        const selectedId = e.target.value;
        const selectedMachine = state.machines.find(m => m.id === selectedId);
        const newInitialInput = document.getElementById('change-new-initial-counter');
        const hintEl = document.getElementById('change-new-hint');
        if (selectedMachine) {
            newInitialInput.value = selectedMachine.machineCounter || 0;
            hintEl.textContent = `Contador actual en stock: ${(selectedMachine.machineCounter || 0).toLocaleString('es-AR')} copias.`;
        } else {
            newInitialInput.value = 0;
            hintEl.textContent = 'Se pre-completa con el contador actual del stock.';
        }
    };

    document.getElementById('modal-change-machine').style.display = 'block';
};

async function submitChangeMachine(e) {
    e.preventDefault();
    const oldMachineId = document.getElementById('change-old-machine-id').value;
    const oldFinalCounter = parseInt(document.getElementById('change-old-counter').value, 10) || 0;
    const oldStatus = document.getElementById('change-old-status').value;
    
    const newMachineId = document.getElementById('change-new-machine-id').value;
    const newInitialCounter = parseInt(document.getElementById('change-new-initial-counter').value, 10) || 0;

    if (!newMachineId) {
        showToast('Debes seleccionar el equipo de reemplazo', 'error');
        return;
    }

    const oldMachine = state.machines.find(m => m.id === oldMachineId);
    const newMachine = state.machines.find(m => m.id === newMachineId);

    if (!oldMachine || !newMachine) return;

    if (oldFinalCounter < (oldMachine.machineCounter || 0)) {
        showToast('El contador final de la máquina saliente no puede ser menor a su contador actual', 'error');
        return;
    }

    // Save final status for old machine, check Nuevo to Usado
    let finalOldStatus = oldStatus;
    if (oldMachine.status === 'Nuevo' && oldFinalCounter > 0) {
        finalOldStatus = 'Usado';
    }

    // 1. Process old machine release
    const client = state.clients.find(c => c.id === oldMachine.clientId);
    if (client) {
        // Save old reading log for currentMonth
        const activeReading = state.readings.find(r => r.machineId === oldMachineId && r.month === currentMonth);
        if (activeReading) {
            activeReading.final = oldFinalCounter;
            activeReading.status = 'pending'; // keep it pending so client retains the debt until paid
            await dbSet('readings', activeReading.id, activeReading);
        } else {
            const newReading = {
                id: 'read-' + Date.now(),
                machineId: oldMachineId,
                clientId: oldMachine.clientId,
                abonoId: oldMachine.abonoId || '',
                month: currentMonth,
                initial: oldMachine.machineCounter || 0,
                final: oldFinalCounter,
                status: 'pending' // keep it pending so client retains the debt until paid
            };
            state.readings.push(newReading);
            await dbSet('readings', newReading.id, newReading);
        }
    }

    const savedClientId = oldMachine.clientId;
    const savedAbonoId = oldMachine.abonoId;
    const savedApplyIva = oldMachine.applyIva;
    const savedReadingDay = oldMachine.readingDay;

    // Reset old machine fields and return to stock
    oldMachine.clientId = '';
    oldMachine.abonoId = '';
    oldMachine.machineCounter = oldFinalCounter;
    oldMachine.status = finalOldStatus;
    oldMachine.isAvailable = true;
    oldMachine.installationDate = '';
    oldMachine.initialCounter = 0;
    await dbSet('machines', oldMachineId, oldMachine);

    // 2. Process new machine assignment
    let finalNewStatus = newMachine.status;
    if (newMachine.status === 'Nuevo' && newInitialCounter > 0) {
        finalNewStatus = 'Usado';
    }

    newMachine.clientId = savedClientId;
    newMachine.abonoId = savedAbonoId;
    newMachine.applyIva = savedApplyIva;
    newMachine.readingDay = savedReadingDay;
    newMachine.initialCounter = newInitialCounter;
    newMachine.machineCounter = newInitialCounter;
    newMachine.status = 'En Servicio'; // mark it active
    newMachine.isAvailable = false;
    newMachine.installationDate = new Date().toISOString().split('T')[0];
    await dbSet('machines', newMachineId, newMachine);

    // 3. Create initial reading log for the new machine
    const newReading = {
        id: 'read-' + (Date.now() + 1),
        machineId: newMachineId,
        clientId: savedClientId,
        abonoId: savedAbonoId || '',
        month: currentMonth,
        initial: newInitialCounter,
        final: newInitialCounter,
        status: 'pending'
    };
    state.readings.push(newReading);
    await dbSet('readings', newReading.id, newReading);

    closeAllModals();
    renderApp();
    showToast(`Reemplazo realizado con éxito. Nuevo equipo: ${newMachine.brand || ''} ${newMachine.model}`, 'success');
}

window.openSettleDebtModal = (clientId) => {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    closeAllModals();

    document.getElementById('settle-client-id').value = clientId;
    document.getElementById('settle-client-name').textContent = client.name;

    // Calculate total debt for this client (exactly matching client report calculations)
    const clientReadings = state.readings.filter(r => r.clientId === client.id);

    let totalDebt = 0;
    clientReadings.forEach(r => {
        if (r.status === 'pending') {
            const m = state.machines.find(mac => mac.id === r.machineId);
            const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
            const diff = Math.max(0, r.final - r.initial);
            const exc = abono ? Math.max(0, diff - abono.limit) : 0;
            const ivaRate = (m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
            const fixedCost = abono ? abono.price : 0;
            const excessCost = abono ? exc * abono.excessPrice : 0;
            const net = fixedCost + excessCost;
            const total = net * (1 + ivaRate / 100);
            const alreadyPaid = r.partialPaid || 0;
            const remaining = Math.max(0, total - alreadyPaid);
            totalDebt += remaining;
        }
    });

    document.getElementById('settle-total-debt').textContent = formatCurrency(totalDebt);
    
    const amountInput = document.getElementById('settle-amount');
    amountInput.value = '';
    amountInput.max = totalDebt.toFixed(2);
    amountInput.placeholder = `Ej: ${totalDebt.toFixed(2)}`;

    // Reset settle modal inputs
    document.getElementById('settle-payment-method').value = 'Efectivo';
    document.getElementById('settle-payment-ref').value = '';
    document.getElementById('settle-payment-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('settle-bank-reconciled').checked = false;
    document.getElementById('settle-bank-details').style.display = 'none';
    document.getElementById('settle-negro-warning').style.display = 'none';

    // Wire payment method selection handler
    const methodSelect = document.getElementById('settle-payment-method');
    methodSelect.onchange = (e) => {
        const val = e.target.value;
        const bankDetails = document.getElementById('settle-bank-details');
        const negroWarning = document.getElementById('settle-negro-warning');
        if (val === 'Transferencia Bancaria' || val === 'Tarjeta de Débito' || val === 'Tarjeta de Crédito' || val === 'Cheque') {
            bankDetails.style.display = 'block';
            negroWarning.style.display = 'none';
        } else if (val === 'En Negro (Efectivo)') {
            bankDetails.style.display = 'none';
            negroWarning.style.display = 'block';
        } else {
            bankDetails.style.display = 'none';
            negroWarning.style.display = 'none';
        }
    };

    document.getElementById('modal-settle-debt').style.display = 'block';
};

async function submitSettleDebt(e) {
    e.preventDefault();
    const clientId = document.getElementById('settle-client-id').value;
    const amountPaidInput = parseFloat(document.getElementById('settle-amount').value) || 0;
    
    if (amountPaidInput <= 0) {
        showToast('Monto de pago inválido', 'error');
        return;
    }

    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const paymentMethod = document.getElementById('settle-payment-method').value;
    const paymentReference = document.getElementById('settle-payment-ref').value.trim();
    const paymentDate = document.getElementById('settle-payment-date').value;
    const bankReconciled = document.getElementById('settle-bank-reconciled').checked;
    const isEnNegro = (paymentMethod === 'En Negro (Efectivo)');

    let amountToDistribute = amountPaidInput;

    // Get all pending readings for this client, sorted by month ascending (oldest first)
    const clientReadings = state.readings.filter(r => r.clientId === clientId && r.status === 'pending');
    clientReadings.sort((a, b) => (a.month || '').localeCompare(b.month || ''));

    if (clientReadings.length === 0) {
        showToast('El cliente no tiene deudas pendientes', 'error');
        closeAllModals();
        return;
    }

    for (let i = 0; i < clientReadings.length; i++) {
        if (amountToDistribute <= 0) break;

        const r = clientReadings[i];
        const m = state.machines.find(mac => mac.id === r.machineId);
        const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
        
        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? exc * abono.excessPrice : 0;
        const net = fixedCost + excessCost;
        const total = net * (1 + ivaRate / 100);

        const alreadyPaid = r.partialPaid || 0;
        const remaining = Math.max(0, total - alreadyPaid);

        r.paymentMethod = paymentMethod;
        r.paymentReference = paymentReference;
        r.paymentDate = paymentDate || new Date().toISOString().split('T')[0];
        
        if (isEnNegro) {
            r.isUnofficial = true;
            r.bankReconciled = false;
        } else {
            r.bankReconciled = bankReconciled;
            if (bankReconciled) {
                r.bankReconciliationDate = paymentDate || new Date().toISOString().split('T')[0];
            }
        }

        if (amountToDistribute >= remaining) {
            // Settle this reading completely
            r.partialPaid = total;
            r.status = 'paid';
            amountToDistribute -= remaining;
        } else {
            // Apply partial payment
            r.partialPaid = alreadyPaid + amountToDistribute;
            amountToDistribute = 0;
        }

        // Save to Firestore and LocalStorage
        await dbSet('readings', r.id, r);
    }

    closeAllModals();
    
    // Re-render background charts, stats, tables to reflect payments immediately
    renderApp();
    
    // Re-open client report to show the updated balance!
    window.openClientReportTrigger(clientId);
    
    showToast(`Pago de ${formatCurrency(amountPaidInput)} registrado con éxito`, 'success');
}

async function runAccountingAuditSuite() {
    const resultsPanel = document.getElementById('audit-results-panel');
    const logsList = document.getElementById('audit-logs-list');
    const globalBadge = document.getElementById('audit-global-badge');
    const fixBtn = document.getElementById('btn-fix-audit-balances');

    if (!resultsPanel || !logsList || !globalBadge) return;

    resultsPanel.style.display = 'block';
    logsList.innerHTML = '<div style="color:var(--text-secondary-light);">Ejecutando suite de pruebas...</div>';
    
    let passed = true;
    let errorsCount = 0;
    let warningsCount = 0;
    const logs = [];

    // Helper log functions
    const logInfo = (msg) => logs.push(`<div style="color:var(--text-secondary-light); margin-bottom:2px;">ℹ️ ${msg}</div>`);
    const logSuccess = (msg) => logs.push(`<div style="color:var(--emerald); font-weight:600; margin-bottom:2px;">✓ ${msg}</div>`);
    const logWarning = (msg) => {
        logs.push(`<div style="color:#d97706; font-weight:600; margin-bottom:2px;">⚠️ ${msg}</div>`);
        warningsCount++;
    };
    const logError = (msg) => {
        logs.push(`<div style="color:#dc2626; font-weight:700; margin-bottom:2px;">❌ ${msg}</div>`);
        passed = false;
        errorsCount++;
    };

    logInfo(`Iniciando Auditoría Contable y de Datos en local. Total Clientes: ${state.clients.length}, Total Lecturas: ${state.readings.length}, Total Máquinas: ${state.machines.length}`);

    // --- PRUEBA 1: Consistencia Aritmética de Lecturas ---
    let arithmeticIssues = [];
    state.readings.forEach(r => {
        const m = state.machines.find(mac => mac.id === r.machineId);
        const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
        
        const isUnofficial = r.isUnofficial || false;
        const creditNote = r.creditNote || 0;
        const debitNote = r.debitNote || 0;

        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (!isUnofficial && m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? exc * abono.excessPrice : 0;
        const net = fixedCost + excessCost;
        const iva = net * (ivaRate / 100);
        const total = net + iva - creditNote + debitNote;
        
        const paid = r.partialPaid || 0;
        const remaining = total - paid;

        // Check paid status matches remaining amount
        if (r.status === 'paid' && Math.abs(remaining) > 0.01) {
            logError(`Lectura ${r.id} (Mes: ${formatPeriod(r.month)}): Marcada COBRADA pero resta saldo: ${formatCurrency(remaining)}. Total: ${formatCurrency(total)}, Pagado: ${formatCurrency(paid)}.`);
            arithmeticIssues.push(r);
        } else if (r.status === 'pending' && remaining <= 0.01 && total > 0) {
            logError(`Lectura ${r.id} (Mes: ${formatPeriod(r.month)}): Marcada PENDIENTE pero está totalmente pagada. Total: ${formatCurrency(total)}, Pagado: ${formatCurrency(paid)}.`);
            arithmeticIssues.push(r);
        } else if (remaining < -0.01) {
            logError(`Lectura ${r.id} (Mes: ${formatPeriod(r.month)}): Pago supera total. Total: ${formatCurrency(total)}, Pagado: ${formatCurrency(paid)}. Sobrepago: ${formatCurrency(Math.abs(remaining))}.`);
            arithmeticIssues.push(r);
        }
    });
    if (arithmeticIssues.length === 0) {
        logSuccess("Prueba 1 (Consistencia de Estados y Saldos) - PASSED");
    } else {
        logError(`Prueba 1 (Consistencia de Estados y Saldos) - FAILED (${arithmeticIssues.length} desvíos aritméticos detectados)`);
    }

    // --- PRUEBA 2: Integridad Fiscal de IVA ("En Negro") ---
    let taxIssuesCount = 0;
    state.readings.forEach(r => {
        if (r.isUnofficial) {
            const m = state.machines.find(mac => mac.id === r.machineId);
            const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
            
            // Double check if calculated IVA is zero
            const appliedIvaRate = (!r.isUnofficial && m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
            if (appliedIvaRate > 0) {
                logError(`Lectura ${r.id} (Mes: ${formatPeriod(r.month)}): Marcada 'En Negro' pero conserva tasa de IVA del ${appliedIvaRate}%.`);
                taxIssuesCount++;
            }
        }
    });
    if (taxIssuesCount === 0) {
        logSuccess("Prueba 2 (Integridad Impositiva de Facturas 'En Negro') - PASSED");
    } else {
        logError(`Prueba 2 (Integridad Impositiva de Facturas 'En Negro') - FAILED (${taxIssuesCount} fallos impositivos)`);
    }

    // --- PRUEBA 3: Trazabilidad Histórica y Huérfanos ---
    let orphanedClients = 0;
    let orphanedMachines = 0;
    state.readings.forEach(r => {
        const clientExists = state.clients.some(c => c.id === r.clientId);
        if (!clientExists) {
            logWarning(`Registro Contable Huérfano: Lectura ${r.id} asociada al cliente ID ${r.clientId} que ya no existe.`);
            orphanedClients++;
        }
        const machineExists = state.machines.some(m => m.id === r.machineId);
        if (!machineExists) {
            logWarning(`Registro Técnico Huérfano: Lectura ${r.id} asociada a máquina ID ${r.machineId} eliminada de stock.`);
            orphanedMachines++;
        }
    });
    if (orphanedClients === 0 && orphanedMachines === 0) {
        logSuccess("Prueba 3 (Trazabilidad Histórica y Relacional) - PASSED");
    } else {
        logInfo(`Prueba 3 completada con advertencias: ${orphanedClients} clientes huérfanos, ${orphanedMachines} máquinas huérfanas en el historial de lecturas.`);
    }

    // --- PRUEBA 4: Continuidad Correlativa de Lectores ---
    let meterIssuesCount = 0;
    const machinesMap = {};
    state.readings.forEach(r => {
        if (!machinesMap[r.machineId]) {
            machinesMap[r.machineId] = [];
        }
        machinesMap[r.machineId].push(r);
    });

    Object.keys(machinesMap).forEach(mId => {
        const mReadings = machinesMap[mId];
        mReadings.sort((a, b) => (a.month || '').localeCompare(b.month || ''));
        const mach = state.machines.find(m => m.id === mId);
        const machLabel = mach ? `${mach.brand} ${mach.model} (${mach.serial})` : `ID: ${mId}`;

        for (let i = 0; i < mReadings.length; i++) {
            const r = mReadings[i];
            if (r.final < r.initial) {
                logError(`Equipo ${machLabel} en período ${formatPeriod(r.month)}: Lectura final (${r.final}) es menor que lectura inicial (${r.initial}). Consumo negativo.`);
                meterIssuesCount++;
            }
            if (i > 0) {
                const prev = mReadings[i - 1];
                if (prev.final > r.initial) {
                    logWarning(`Equipo ${machLabel}: Salto negativo de contadores. Mes ${formatPeriod(prev.month)} finalizó en ${prev.final} pero mes ${formatPeriod(r.month)} inició en ${r.initial}. Posible recalibración o desajuste.`);
                }
            }
        }
    });
    if (meterIssuesCount === 0) {
        logSuccess("Prueba 4 (Correlatividad y Veracidad de Contadores) - PASSED");
    } else {
        logError(`Prueba 4 (Correlatividad y Veracidad de Contadores) - FAILED (${meterIssuesCount} consumos negativos)`);
    }

    // --- PRUEBA 5: Consistencia de Conciliación Bancaria ---
    let bankIssuesCount = 0;
    state.readings.forEach(r => {
        if (r.bankReconciled) {
            const isCash = r.paymentMethod === 'Efectivo' || r.paymentMethod === 'En Negro (Efectivo)';
            if (isCash) {
                logWarning(`Lectura ${r.id} (Mes: ${formatPeriod(r.month)}): Conciliada con el banco pero cobrada en Efectivo.`);
                bankIssuesCount++;
            }
            if (!r.paymentReference) {
                logWarning(`Lectura ${r.id} (Mes: ${formatPeriod(r.month)}): Marcada conciliada pero no posee Referencia de transacción.`);
                bankIssuesCount++;
            }
        }
    });
    if (bankIssuesCount === 0) {
        logSuccess("Prueba 5 (Consistencia de Conciliación Bancaria) - PASSED");
    } else {
        logInfo(`Prueba 5 completada con advertencias: ${bankIssuesCount} registros conciliados con inconsistencia menor.`);
    }

    // Output final status
    logsList.innerHTML = logs.join('');
    
    if (passed) {
        globalBadge.className = 'badge success';
        globalBadge.textContent = 'PASÓ';
        globalBadge.style.backgroundColor = 'var(--emerald)';
        fixBtn.style.display = 'none';
        showToast('Auditoría Contable Finalizada: Todos los estados coinciden.', 'success');
    } else {
        globalBadge.className = 'badge danger';
        globalBadge.textContent = 'CON DESVÍOS';
        globalBadge.style.backgroundColor = '#dc2626';
        fixBtn.style.display = 'inline-flex';
        showToast(`Auditoría Contable Finalizada con desvíos (${errorsCount} errores, ${warningsCount} advertencias)`, 'warning');
    }
}

async function fixAccountingAuditBalances() {
    if (!confirm('¿Deseas auto-corregir los desvíos contables detectados? Se ajustarán los estados de cobro y saldos parciales inconsistentes para cuadrar los balances contables.')) {
        return;
    }

    let fixedCount = 0;
    for (let i = 0; i < state.readings.length; i++) {
        const r = state.readings[i];
        const m = state.machines.find(mac => mac.id === r.machineId);
        const abono = state.abonos.find(a => a.id === r.abonoId) || (m ? state.abonos.find(a => a.id === m.abonoId) : null);
        
        const isUnofficial = r.isUnofficial || false;
        const creditNote = r.creditNote || 0;
        const debitNote = r.debitNote || 0;

        const diff = Math.max(0, r.final - r.initial);
        const exc = abono ? Math.max(0, diff - abono.limit) : 0;
        const ivaRate = (!isUnofficial && m && m.applyIva && abono) ? (abono.ivaRate || 0) : 0;
        const fixedCost = abono ? abono.price : 0;
        const excessCost = abono ? exc * abono.excessPrice : 0;
        const net = fixedCost + excessCost;
        const iva = net * (ivaRate / 100);
        const total = net + iva - creditNote + debitNote;
        
        const paid = r.partialPaid || 0;
        const remaining = total - paid;

        let needsSave = false;

        // Correct status vs remaining amount
        if (r.status === 'paid' && Math.abs(remaining) > 0.01) {
            r.partialPaid = total;
            needsSave = true;
            fixedCount++;
        } else if (r.status === 'pending' && remaining <= 0.01 && total > 0) {
            r.status = 'paid';
            r.partialPaid = total;
            needsSave = true;
            fixedCount++;
        } else if (remaining < -0.01) {
            r.partialPaid = total;
            needsSave = true;
            fixedCount++;
        }

        if (needsSave) {
            await dbSet('readings', r.id, r);
        }
    }

    showToast(`Se corrigieron exitosamente ${fixedCount} inconsistencias contables.`, 'success');
    renderApp();
    
    // Re-run audit to show fresh clean results!
    runAccountingAuditSuite();
}

