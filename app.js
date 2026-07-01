// State Management
let state = {
    clients: [],
    machines: [],
    abonos: [],
    readings: [],
    maintenance: [],
    users: [],
    currentUser: null
};

// Current Active Tab
let currentTab = 'dashboard';
// Current Active Month (YYYY-MM format, default to current month or latest data month)
let currentMonth = '2026-06'; // realistic starting point matching metadata

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
    // Set default month selector value
    monthSelector.value = currentMonth;
    
    // Load Firebase if credentials exist, otherwise load from localStorage
    await loadDatabase();

    // Init security gate
    checkAuthSession();
    
    // Set up Event Listeners
    setupNavigation();
    setupForms();
    setupActions();
    
    // Update logo preview in Data Management tab
    updateLogoPreview();
    
    // Wire up Firebase controls
    setupFirebaseControls();
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
                password: 'jUEVES2389$'
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
            await db.collection(collectionName).doc(docId).set(data);
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
        roleEl.textContent = user.username === 'dmoyano' ? 'Administrador' : 'Operador';
        
        // Generate initials
        const parts = user.fullname.split(' ');
        const initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
        initialsEl.textContent = initials || 'US';

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
            if (state.currentUser === undefined) state.currentUser = null;
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
                password: 'jUEVES2389$'
            }
        ];
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
    }
}

function renderApp() {
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
                            <div style="margin-top:15px; display:flex; gap:8px;">
                                <button class="btn btn-primary btn-sm flex-1" onclick="openReadingModal('${m.id}', currentMonth)" style="font-size:11px; padding:6px; justify-content:center; white-space:nowrap;">+ Cargar Lectura</button>
                                <button class="btn btn-secondary btn-sm flex-1" onclick="openAddMaintenanceTrigger('${m.id}')" style="font-size:11px; padding:6px; justify-content:center; white-space:nowrap;">+ Registrar Cambio</button>
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
            await dbSet('clients', clientData.id, clientData);
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

        const machineData = {
            id: id || ('machine-' + Date.now()),
            brand,
            model,
            serial,
            type,
            status,
            machineCounter,
            clientId: clientId || '',
            abonoId: abonoId || '',
            installationDate: clientId ? (installationDate || new Date().toISOString().split('T')[0]) : '',
            initialCounter: clientId ? initialCounter : 0,
            applyIva: clientId ? applyIva : false,
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

        await dbSet('machines', machineData.id, machineData);
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

        await dbSet('abonos', abonoData.id, abonoData);
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

        const readingData = {
            id: id || ('read-' + Date.now()),
            machineId,
            month,
            initial,
            final,
            status
        };

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

        await dbSet('readings', readingData.id, readingData);
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

        const copies = Math.max(0, final - initial);
        const excess = Math.max(0, copies - abono.limit);
        const fixedFee = abono.price;
        const excessFee = excess * abono.excessPrice;
        const netCost = fixedFee + excessFee;
        const ivaRate = machine.applyIva ? (abono.ivaRate || 0) : 0;
        const ivaCost = netCost * (ivaRate / 100);
        const total = netCost + ivaCost;

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
                    // Use a secondary app instance so GCM / active session is not modified/logged-out
                    const secondaryApp = firebase.initializeApp(config, 'SecondaryApp');
                    await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
                    await secondaryApp.delete();
                }
            } catch (authErr) {
                console.error("Error creating user in Firebase Auth:", authErr);
                showToast("Error de Firebase Auth: " + authErr.message, "error");
                return;
            }
        }

        const userData = { id: id || ('user-' + Date.now()), username, fullname, email, password };

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

        await dbSet('users', userData.id, userData);
        closeAllModals();
        checkAuthSession(); // Updates sidebar profile if we updated ourselves
        renderUsersTab();
    });
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

    // Sync previous month final readings
    document.getElementById('btn-sync-previous-readings').addEventListener('click', () => {
        syncFinalReadings();
    });

    // Data backups
    document.getElementById('btn-export-data').addEventListener('click', exportDataToJSON);
    document.getElementById('import-file-input').addEventListener('change', importDataFromJSON);
    
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
            const userObj = state.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase());
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
            } catch (err) {
                console.warn("Firebase Auth sign-in failed, trying fallback creation:", err);
                
                // Fallback: If password matches the database record, attempt to auto-create the user in Firebase Auth!
                if (userObj.password === password) {
                    try {
                        showToast('Registrando usuario en la nube...', 'info');
                        await firebase.auth().createUserWithEmailAndPassword(userObj.email, password);
                        // Success! Now we are logged in automatically by createUserWithEmailAndPassword
                        state.currentUser = userObj;
                        saveToLocalStorage();
                        checkAuthSession();
                        showToast('¡Bienvenido y registrado en la nube, ' + userObj.fullname + '!', 'success');
                        document.getElementById('form-login').reset();
                        return;
                    } catch (createErr) {
                        console.error("Auto-registration failed:", createErr);
                        if (createErr.code === 'auth/operation-not-allowed') {
                            showToast('Error: Debes habilitar "Correo electrónico y contraseña" en la pestaña Authentication de tu consola de Firebase.', 'error');
                            return;
                        }
                    }
                }
                showToast('Usuario o contraseña incorrectos en Firebase Auth', 'error');
            }
        } else {
            const user = state.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase());
            if (user && user.password === password) {
                state.currentUser = user;
                saveToLocalStorage();
                checkAuthSession();
                showToast('¡Bienvenido de nuevo, ' + user.fullname + '!', 'success');
                document.getElementById('form-login').reset();
            } else {
                showToast('Usuario o contraseña incorrectos', 'error');
            }
        }
    });

    // Logout trigger
    document.getElementById('btn-logout').addEventListener('click', () => {
        if (confirm('¿Seguro que deseas cerrar la sesión actual?')) {
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

        const availSelect = document.getElementById('machine-availability');
        availSelect.value = 'true';
        availSelect.disabled = false;
    }
    
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
    
    let defaultInitial = 0;
    if (prevReading) {
        defaultInitial = prevReading.final;
        hintText.textContent = `Lectura final de ${formatPeriod(prevMonthStr)}: ${defaultInitial.toLocaleString('es-AR')}`;
    } else {
        hintText.textContent = `Sin lecturas en ${formatPeriod(prevMonthStr)}. Cargar lectura inicial manualmente.`;
    }

    if (reading) {
        document.getElementById('reading-id').value = reading.id;
        document.getElementById('reading-initial').value = reading.initial;
        document.getElementById('reading-final').value = reading.final;
        document.getElementById('reading-status').value = reading.status;
    } else {
        document.getElementById('reading-id').value = '';
        document.getElementById('reading-initial').value = defaultInitial;
        document.getElementById('reading-final').value = defaultInitial; // default matching
        document.getElementById('reading-status').value = 'pending';
    }

    // Trigger calculation updates
    const initialInput = document.getElementById('reading-initial');
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
    const ivaRate = machine.applyIva ? (abono.ivaRate || 0) : 0;
    const ivaCost = netSubtotal * (ivaRate / 100);
    const totalGeneral = netSubtotal + ivaCost;

    // Receipt header
    document.getElementById('receipt-period').textContent = formatPeriod(reading.month);
    
    // Date of receipt is today
    const today = new Date();
    document.getElementById('receipt-date').textContent = today.toLocaleDateString('es-AR');

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
        // If no excess, we can either hide the details or show them as zero excess
        excessRow.style.display = 'table-row';
        document.getElementById('receipt-counter-start').textContent = reading.initial.toLocaleString('es-AR');
        document.getElementById('receipt-counter-end').textContent = reading.final.toLocaleString('es-AR');
        document.getElementById('receipt-total-copies').textContent = copies.toLocaleString('es-AR');
        document.getElementById('receipt-excess-qty').textContent = `0 exc.`;
        document.getElementById('receipt-excess-unit-price').textContent = formatCurrency(abono.excessPrice);
        document.getElementById('receipt-excess-subtotal').textContent = formatCurrency(0);
    }

    // Totals Block
    document.getElementById('receipt-summary-base').textContent = formatCurrency(netSubtotal);
    document.getElementById('receipt-iva-rate-label').textContent = machine.applyIva && ivaRate > 0 ? `${ivaRate}%` : 'No IVA';
    document.getElementById('receipt-summary-iva').textContent = formatCurrency(ivaCost);
    document.getElementById('receipt-summary-total').textContent = formatCurrency(totalGeneral);

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
                await dbSet('readings', reading.id, state.readings[idx]);
                renderApp();
                showToast('Comprobante marcado como cobrado', 'success');
                openInvoiceModal(state.readings[idx]); // refresh modal
            }
        };
    }

    document.getElementById('modal-invoice-detail').style.display = 'block';
}


// Tab View 1: Dashboard
function renderDashboardTab() {
    // 1. Calculate General Metrics
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
                
                const netCost = fixedCost + excessCost;
                const ivaCost = netCost * (ivaRate / 100);
                const totalCost = netCost + ivaCost;

                totalInvoiced += totalCost;
                excessInvoiced += excessCost * (1 + ivaRate / 100); // excess with IVA

                if (reading.status === 'paid') {
                    paidAmt += totalCost;
                } else {
                    pendingAmt += totalCost;
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

    // Update numbers
    document.getElementById('stat-active-clients').textContent = activeClientsCount;
    document.getElementById('stat-rented-machines').textContent = rentedMachinesCount;
    document.getElementById('stat-fixed-revenue').textContent = formatCurrency(projectedBase);
    document.getElementById('stat-total-revenue').textContent = formatCurrency(totalInvoiced);
    document.getElementById('stat-excedente-revenue').textContent = `Excedentes: ${formatCurrency(excessInvoiced)}`;

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

    // 2. Progress of readings
    const totalToRead = rentedMachinesCount;
    const progressPct = totalToRead > 0 ? Math.round((loggedReadingsCount / totalToRead) * 100) : 0;
    document.getElementById('dashboard-month-label').textContent = formatPeriod(currentMonth);
    document.getElementById('readings-progress-percent').textContent = `${progressPct}%`;
    document.getElementById('readings-progress-bar').style.width = `${progressPct}%`;
    document.getElementById('readings-progress-desc').textContent = `${loggedReadingsCount} de ${totalToRead} máquinas registradas en el mes`;

    // 3. Pending Readings Table
    const dashboardTableBody = document.querySelector('#dashboard-pending-readings-table tbody');
    dashboardTableBody.innerHTML = '';

    if (rentedMachines.length === 0) {
        dashboardTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No hay máquinas alquiladas registradas. Ve a Máquinas para asignar.</td></tr>`;
        return;
    }

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

window.deleteClientTrigger = async (clientId) => {
    if (confirm('¿Seguro que deseas eliminar este cliente? No se desasignarán las máquinas de forma automática pero dejará huérfanas sus referencias.')) {
        state.clients = state.clients.filter(c => c.id !== clientId);
        await dbDelete('clients', clientId);
        renderApp();
        showToast('Cliente eliminado', 'warning');
    }
};

window.editMachineTrigger = (machineId) => {
    const machine = state.machines.find(m => m.id === machineId);
    if (machine) openMachineModal(machine);
};

window.deleteMachineTrigger = async (machineId) => {
    if (confirm('¿Seguro que deseas eliminar esta máquina? Se perderá su historial de lecturas asociadas.')) {
        const readingsToDelete = state.readings.filter(r => r.machineId === machineId);
        state.machines = state.machines.filter(m => m.id !== machineId);
        state.readings = state.readings.filter(r => r.machineId !== machineId);
        
        await dbDelete('machines', machineId);
        for (const r of readingsToDelete) {
            await dbDelete('readings', r.id);
        }
        
        renderApp();
        showToast('Máquina eliminada', 'warning');
    }
};

window.editAbonoTrigger = (abonoId) => {
    const abono = state.abonos.find(a => a.id === abonoId);
    if (abono) openAbonoModal(abono);
};

window.deleteAbonoTrigger = async (abonoId) => {
    // Check if being used
    const inUse = state.machines.some(m => m.abonoId === abonoId);
    if (inUse) {
        showToast('No se puede eliminar el abono porque está asignado a una o más máquinas activas', 'error');
        return;
    }
    if (confirm('¿Seguro que deseas eliminar este abono?')) {
        state.abonos = state.abonos.filter(a => a.id !== abonoId);
        await dbDelete('abonos', abonoId);
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

    // Filter state.readings
    let filteredReadings = state.readings.filter(reading => {
        const machine = state.machines.find(m => m.id === reading.machineId);
        if (!machine) return false;
        const client = state.clients.find(c => c.id === machine.clientId);
        const clientName = client ? client.name.toLowerCase() : '';
        const machineName = `${machine.brand || ''} ${machine.model}`.toLowerCase();
        
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
        const machineA = state.machines.find(m => m.id === a.machineId);
        const machineB = state.machines.find(m => m.id === b.machineId);
        const nameA = (state.clients.find(c => c.id === machineA?.clientId)?.name || '').toLowerCase();
        const nameB = (state.clients.find(c => c.id === machineB?.clientId)?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    if (filteredReadings.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="13" class="text-center py-4">No se encontraron registros en el historial.</td></tr>`;
        return;
    }

    filteredReadings.forEach(reading => {
        const machine = state.machines.find(m => m.id === reading.machineId);
        if (!machine) return;
        const client = state.clients.find(c => c.id === machine.clientId);
        const abono = state.abonos.find(a => a.id === machine.abonoId);

        const clientName = client ? client.name : 'Cliente no asignado';
        const machineName = `${machine.brand || ''} ${machine.model}`;
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
        
        const ivaRate = machine.applyIva && abono ? (abono.ivaRate || 0) : 0;
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
            <td>${machineName} <span class="text-xs text-secondary-light">(${machine.serial})</span></td>
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
                    <button class="btn btn-secondary btn-sm" onclick="editMachineTrigger('${machine.id}')">Editar</button>
                    ${machine.clientId ? `<button class="btn btn-secondary btn-sm" onclick="openMaintenanceHistoryTrigger('${machine.id}')">Historial</button>` : ''}
                    <button class="btn btn-danger-outline btn-sm" onclick="deleteMachineTrigger('${machine.id}')">Eliminar</button>
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
                            password: 'jUEVES2389$'
                        }
                    ];
                }
                if (state.currentUser === undefined || state.currentUser === null) {
                    state.currentUser = currentSession;
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

window.deleteMaintenanceEntryTrigger = async (entryId) => {
    if (confirm('¿Seguro que deseas eliminar este registro del historial?')) {
        const entry = state.maintenance.find(e => e.id === entryId);
        const machineId = entry ? entry.machineId : null;
        
        state.maintenance = state.maintenance.filter(e => e.id !== entryId);
        await dbDelete('maintenance', entryId);
        
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

    await dbSet('maintenance', entryData.id, entryData);
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

        row.innerHTML = `
            <td><strong>${user.username}</strong> ${isMaster ? '<span class="badge success" style="font-size:9px; padding:1px 4px; margin-left:4px;">Master</span>' : ''}</td>
            <td>${user.fullname}</td>
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

            // Master admin username cannot be edited to protect integrity
            if (user.username === 'dmoyano') {
                usernameInput.disabled = true;
            } else {
                usernameInput.disabled = false;
            }
        }
    } else {
        titleEl.textContent = 'Agregar Usuario';
        idInput.value = '';
        usernameInput.disabled = false;
    }

    modal.style.display = 'block';
}

window.editUserTrigger = (userId) => {
    openUserModal(userId);
};

window.deleteUserTrigger = async (userId) => {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    if (user.username === 'dmoyano') {
        showToast('No se puede eliminar el usuario administrador maestro (dmoyano)', 'error');
        return;
    }

    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${user.username}"?`)) {
        state.users = state.users.filter(u => u.id !== userId);
        await dbDelete('users', userId);
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
            for (const u of state.users) await db.collection('users').doc(u.id).set(u);
            
            if (state.companyLogo) {
                await db.collection('settings').doc('companyLogo').set({ value: state.companyLogo });
            }
        } catch (err) {
            console.error("Error syncing state to Firestore:", err);
            showToast("Error al sincronizar datos con la nube.", "error");
        }
    }
}

