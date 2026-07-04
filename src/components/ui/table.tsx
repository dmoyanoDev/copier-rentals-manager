import React from 'react';

export const TableContainer = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={`w-full overflow-x-auto rounded-lg border border-slate-800 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const Table = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableElement>) => {
  return (
    <table className={`w-full text-sm text-left text-slate-300 ${className}`} {...props}>
      {children}
    </table>
  );
};

export const TableHeader = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => {
  return (
    <thead className={`bg-slate-900/50 text-xs text-slate-400 uppercase border-b border-slate-800 ${className}`} {...props}>
      {children}
    </thead>
  );
};

export const TableBody = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => {
  return (
    <tbody className={`divide-y divide-slate-800 bg-slate-950 ${className}`} {...props}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => {
  return (
    <tr className={`hover:bg-slate-900/50 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
};

export const TableHead = ({ className = '', children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => {
  return (
    <th className={`px-6 py-3 font-semibold text-slate-300 ${className}`} {...props}>
      {children}
    </th>
  );
};

export const TableHeaderCell = TableHead;

export const TableCell = ({ className = '', children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => {
  return (
    <td className={`px-6 py-4 text-slate-300 font-medium ${className}`} {...props}>
      {children}
    </td>
  );
};

