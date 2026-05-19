// ============================================================
// reportesController.js
// ============================================================
const ReportesController = {
    _desde: '',
    _hasta: '',
    _tab: 'ventas',

    async render(view) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        if (!this._desde) this._desde = `${y}-${m}-01`;
        if (!this._hasta) this._hasta = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

        view.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h2>Reportes</h2>
                    <p>Analisis y estadisticas del negocio</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-outline" onclick="ReportesController.exportarCSV()">
                        ${Utils.icon('download')} Exportar CSV
                    </button>
                </div>
            </div>

            <div class="reportes-filters">
                <div class="form-group">
                    <label class="form-label">Desde</label>
                    <input type="date" class="form-input" id="rep-desde" value="${this._desde}"/>
                </div>
                <div class="form-group">
                    <label class="form-label">Hasta</label>
                    <input type="date" class="form-input" id="rep-hasta" value="${this._hasta}"/>
                </div>
                <div style="display:flex;gap:8px;align-items:flex-end">
                    <button class="btn btn-primary" onclick="ReportesController.aplicarFiltros()">Aplicar</button>
                    <button class="btn btn-outline" onclick="ReportesController.mesActual()">Este mes</button>
                    <button class="btn btn-outline" onclick="ReportesController.mesAnterior()">Mes anterior</button>
                </div>
            </div>

            <div class="tabs">
                <button class="tab-btn ${this._tab === 'ventas' ? 'active' : ''}" onclick="ReportesController.switchTab('ventas')">Ventas</button>
                <button class="tab-btn ${this._tab === 'compras' ? 'active' : ''}" onclick="ReportesController.switchTab('compras')">Compras</button>
                <button class="tab-btn ${this._tab === 'stock' ? 'active' : ''}" onclick="ReportesController.switchTab('stock')">Stock</button>
                <button class="tab-btn ${this._tab === 'productos' ? 'active' : ''}" onclick="ReportesController.switchTab('productos')">Top productos</button>
            </div>

            <div id="reporte-content">
                <div class="page-loading"><div class="spinner"></div></div>
            </div>
        `;

        await this._loadTab(this._tab);
    },

    async aplicarFiltros() {
        this._desde = document.getElementById('rep-desde')?.value || this._desde;
        this._hasta = document.getElementById('rep-hasta')?.value || this._hasta;
        await this._loadTab(this._tab);
    },

    mesActual() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        this._desde = `${y}-${m}-01`;
        this._hasta = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
        document.getElementById('rep-desde').value = this._desde;
        document.getElementById('rep-hasta').value = this._hasta;
        this._loadTab(this._tab);
    },

    mesAnterior() {
        const now = new Date();
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
        this._desde = `${y}-${m}-01`;
        this._hasta = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        document.getElementById('rep-desde').value = this._desde;
        document.getElementById('rep-hasta').value = this._hasta;
        this._loadTab(this._tab);
    },

    switchTab(tab) {
        this._tab = tab;
        document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
            const tabs = ['ventas', 'compras', 'stock', 'productos'];
            btn.classList.toggle('active', tabs[idx] === tab);
        });
        this._loadTab(tab);
    },

    async _loadTab(tab) {
        const content = document.getElementById('reporte-content');
        if (!content) return;
        content.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

        try {
            if (tab === 'ventas') await this._renderVentas(content);
            else if (tab === 'compras') await this._renderCompras(content);
            else if (tab === 'stock') await this._renderStock(content);
            else if (tab === 'productos') await this._renderTopProductos(content);
        } catch (err) {
            content.innerHTML = `<div class="page-error"><p>${Utils.escape(err.message)}</p></div>`;
        }
    },

    async _getVentasFiltradas() {
        const rows = await SupabaseClient.select('ventas', {
            select: '*',
            or: Utils.buildDateOrFilter(this._desde, this._hasta),
            order: 'created_at.desc'
        });
        return rows.filter(v => {
            const d = Utils.effectiveDate(v);
            return d >= this._desde && d <= this._hasta;
        });
    },

    async _getComprasFiltradas() {
        const rows = await SupabaseClient.select('compras', {
            select: '*',
            or: Utils.buildDateOrFilter(this._desde, this._hasta),
            order: 'created_at.desc'
        });
        return rows.filter(c => {
            const d = Utils.effectiveDate(c);
            return d >= this._desde && d <= this._hasta;
        });
    },

    async _renderVentas(content) {
        const filtered = await this._getVentasFiltradas();
        const completadas = filtered.filter(v => v.estado === 'completada');
        const canceladas = filtered.filter(v => v.estado === 'cancelada');
        const total = completadas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const ticketProm = completadas.length ? total / completadas.length : 0;

        const porDia = {};
        completadas.forEach(v => {
            const dia = Utils.effectiveDate(v);
            porDia[dia] = (porDia[dia] || 0) + parseFloat(v.total || 0);
        });

        const porCliente = {};
        completadas.forEach(v => {
            const k = v.cliente_nombre || 'Consumidor final';
            if (!porCliente[k]) porCliente[k] = { nombre: k, ventas: 0, total: 0 };
            porCliente[k].ventas++;
            porCliente[k].total += parseFloat(v.total || 0);
        });
        const topClientes = Object.values(porCliente).sort((a, b) => b.total - a.total).slice(0, 10);

        content.innerHTML = `
            <div class="kpi-row">
                <div class="kpi-card">
                    <span class="kpi-label">Total ventas netas</span>
                    <span class="kpi-value">${Utils.currency(total)}</span>
                    <span class="kpi-sub">${completadas.length} completada(s)</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Ticket promedio</span>
                    <span class="kpi-value">${Utils.currency(ticketProm)}</span>
                    <span class="kpi-sub">solo ventas completadas</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Canceladas</span>
                    <span class="kpi-value" style="color:#dc2626">${canceladas.length}</span>
                    <span class="kpi-sub">de ${filtered.length} total</span>
                </div>
            </div>

            <div class="section-grid">
                <div class="card">
                    <div class="card-header"><span class="card-title">Ventas por día</span></div>
                    ${this._buildDayTable(porDia)}
                </div>
                <div class="card">
                    <div class="card-header"><span class="card-title">Top clientes</span></div>
                    ${topClientes.length ? `<div class="recent-list">
                        ${topClientes.map(c => `
                            <div class="recent-item">
                                <div class="recent-item-left">
                                    <span class="recent-item-title">${Utils.escape(c.nombre)}</span>
                                    <span class="recent-item-sub">${c.ventas} compra(s)</span>
                                </div>
                                <span class="recent-item-right">${Utils.currency(c.total)}</span>
                            </div>`).join('')}
                    </div>` : '<div class="empty-state"><p>Sin datos</p></div>'}
                </div>
            </div>

            <div class="card" style="margin-top:20px">
                <div class="card-header"><span class="card-title">Detalle de ventas</span></div>
                <div class="table-wrapper">
                    ${filtered.length ? `<table class="table">
                        <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th><th>Estado</th></tr></thead>
                        <tbody>${filtered.map(v => `<tr>
                            <td style="font-family:var(--font-mono);font-size:.78rem">#${v.id}</td>
                            <td>${Utils.date(v.fecha || v.created_at)}</td>
                            <td>${Utils.escape(v.cliente_nombre || 'Consumidor final')}</td>
                            <td>${v.items_count || 0}</td>
                            <td class="precio-cell">${Utils.currency(v.total)}</td>
                            <td>${Utils.statusBadge(v.estado)}</td>
                        </tr>`).join('')}</tbody>
                    </table>` : '<div class="empty-state"><p>Sin ventas en el periodo seleccionado</p></div>'}
                </div>
            </div>
        `;
    },

    async _renderCompras(content) {
        const filtered = await this._getComprasFiltradas();
        const recibidas = filtered.filter(c => c.estado === 'recibida');
        const total = recibidas.reduce((s, c) => s + parseFloat(c.total || 0), 0);

        const porProv = {};
        recibidas.forEach(c => {
            const k = c.proveedor_nombre || 'Sin proveedor';
            if (!porProv[k]) porProv[k] = { nombre: k, compras: 0, total: 0 };
            porProv[k].compras++;
            porProv[k].total += parseFloat(c.total || 0);
        });
        const topProvs = Object.values(porProv).sort((a, b) => b.total - a.total).slice(0, 8);

        content.innerHTML = `
            <div class="kpi-row">
                <div class="kpi-card">
                    <span class="kpi-label">Total compras netas</span>
                    <span class="kpi-value">${Utils.currency(total)}</span>
                    <span class="kpi-sub">${recibidas.length} activa(s)</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Promedio por orden</span>
                    <span class="kpi-value">${Utils.currency(recibidas.length ? total / recibidas.length : 0)}</span>
                    <span class="kpi-sub">sin canceladas</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Proveedores activos</span>
                    <span class="kpi-value">${topProvs.length}</span>
                    <span class="kpi-sub">en el periodo</span>
                </div>
            </div>

            <div class="card" style="margin-bottom:20px">
                <div class="card-header"><span class="card-title">Top proveedores</span></div>
                ${topProvs.length ? `<div class="recent-list">
                    ${topProvs.map(p => `
                        <div class="recent-item">
                            <div class="recent-item-left">
                                <span class="recent-item-title">${Utils.escape(p.nombre)}</span>
                                <span class="recent-item-sub">${p.compras} orden(es)</span>
                            </div>
                            <span class="recent-item-right">${Utils.currency(p.total)}</span>
                        </div>`).join('')}
                </div>` : '<div class="empty-state"><p>Sin datos</p></div>'}
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">Detalle de compras</span></div>
                <div class="table-wrapper">
                    ${filtered.length ? `<table class="table">
                        <thead><tr><th>#</th><th>Fecha</th><th>Proveedor</th><th>Items</th><th>Total</th><th>Estado</th></tr></thead>
                        <tbody>${filtered.map(c => `<tr>
                            <td style="font-family:var(--font-mono);font-size:.78rem">#${c.id}</td>
                            <td>${Utils.date(c.fecha || c.created_at)}</td>
                            <td>${Utils.escape(c.proveedor_nombre || 'Sin proveedor')}</td>
                            <td>${c.items_count || 0}</td>
                            <td class="precio-cell">${Utils.currency(c.total)}</td>
                            <td>${Utils.statusBadge(c.estado)}</td>
                        </tr>`).join('')}</tbody>
                    </table>` : '<div class="empty-state"><p>Sin compras en el periodo seleccionado</p></div>'}
                </div>
            </div>
        `;
    },

    async _renderStock(content) {
        const productos = await SupabaseClient.select('productos', { select: '*', order: 'stock.asc', activo: 'eq.true' });

        const sinStock = productos.filter(p => (p.stock || 0) === 0);
        const stockBajo = productos.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= CONFIG.STOCK_MINIMO);
        const stockNormal = productos.filter(p => (p.stock || 0) > CONFIG.STOCK_MINIMO);
        const valorTotal = productos.reduce((s, p) => s + ((p.stock || 0) * parseFloat(p.precio_compra || 0)), 0);
        const margenPotencial = productos.reduce((s, p) => s + ((p.stock || 0) * (parseFloat(p.precio || 0) - parseFloat(p.precio_compra || 0))), 0);

        content.innerHTML = `
            <div class="kpi-row">
                <div class="kpi-card">
                    <span class="kpi-label">Valor total inventario</span>
                    <span class="kpi-value">${Utils.currency(valorTotal)}</span>
                    <span class="kpi-sub">a precio de compra</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Productos sin stock</span>
                    <span class="kpi-value" style="color:${sinStock.length ? '#dc2626' : 'inherit'}">${sinStock.length}</span>
                    <span class="kpi-sub">de ${productos.length} total</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Margen potencial</span>
                    <span class="kpi-value">${Utils.currency(margenPotencial)}</span>
                    <span class="kpi-sub">${stockNormal.length} en nivel normal / ${stockBajo.length} bajo</span>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">Estado del inventario</span></div>
                <div class="table-wrapper">
                    <table class="table">
                        <thead><tr><th>Codigo</th><th>Producto</th><th>Stock</th><th>P. Compra</th><th>P. Venta</th><th>Valor inv.</th><th>Estado</th></tr></thead>
                        <tbody>${productos.map(p => {
                            const val = (p.stock || 0) * parseFloat(p.precio_compra || 0);
                            const stockClass = (p.stock || 0) === 0 ? 'danger' : (p.stock || 0) <= CONFIG.STOCK_MINIMO ? 'warning' : 'success';
                            return `<tr>
                                <td><span class="producto-code">${Utils.escape(p.codigo || '-')}</span></td>
                                <td><strong>${Utils.escape(p.nombre)}</strong></td>
                                <td style="font-weight:600;color:${(p.stock || 0) === 0 ? '#dc2626' : (p.stock || 0) <= CONFIG.STOCK_MINIMO ? '#f59e0b' : '#16a34a'}">${Utils.number(p.stock)}</td>
                                <td>${Utils.currency(p.precio_compra)}</td>
                                <td>${Utils.currency(p.precio)}</td>
                                <td style="font-weight:500">${Utils.currency(val)}</td>
                                <td><span class="badge badge-${stockClass}">${(p.stock || 0) === 0 ? 'sin stock' : (p.stock || 0) <= CONFIG.STOCK_MINIMO ? 'bajo' : 'normal'}</span></td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async _renderTopProductos(content) {
        const ventas = await this._getVentasFiltradas();
        const ventasIds = ventas.filter(v => v.estado === 'completada').map(v => v.id);

        if (!ventasIds.length) {
            content.innerHTML = `<div class="card"><div class="card-header"><span class="card-title">Top productos mas vendidos (${this._desde} -> ${this._hasta})</span></div><div class="empty-state"><span class="empty-icon">*</span><p>Sin ventas completadas en el periodo</p></div></div>`;
            return;
        }

        const ventaItems = await SupabaseClient.select('venta_items', {
            select: 'producto_id,producto_nombre,cantidad,subtotal,venta_id',
            venta_id: `in.(${ventasIds.join(',')})`
        });

        const filtrados = ventaItems;

        const porProd = {};
        filtrados.forEach(i => {
            const k = i.producto_id;
            if (!porProd[k]) porProd[k] = { nombre: i.producto_nombre, unidades: 0, total: 0 };
            porProd[k].unidades += parseInt(i.cantidad || 0, 10);
            porProd[k].total += parseFloat(i.subtotal || 0);
        });
        const topProds = Object.values(porProd).sort((a, b) => b.total - a.total).slice(0, 20);
        const maxUnidades = Math.max(...topProds.map(p => p.unidades), 1);

        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Top productos mas vendidos (${this._desde} -> ${this._hasta})</span>
                </div>
                ${topProds.length ? `
                <div class="table-wrapper">
                    <table class="table">
                        <thead><tr><th>#</th><th>Producto</th><th>Unidades vendidas</th><th>Participacion</th><th>Total recaudado</th></tr></thead>
                        <tbody>${topProds.map((p, idx) => {
                            const pct = Math.round((p.unidades / maxUnidades) * 100);
                            return `<tr>
                                <td style="font-weight:700;color:var(--gray-400)">${idx + 1}</td>
                                <td><strong>${Utils.escape(p.nombre)}</strong></td>
                                <td>${Utils.number(p.unidades)} uds.</td>
                                <td style="min-width:160px">
                                    <div style="display:flex;align-items:center;gap:8px">
                                        <div class="stock-bar" style="flex:1">
                                            <div class="stock-bar-fill high" style="width:${pct}%"></div>
                                        </div>
                                        <span style="font-size:.78rem;color:var(--gray-500);min-width:30px">${pct}%</span>
                                    </div>
                                </td>
                                <td class="precio-cell">${Utils.currency(p.total)}</td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>` : '<div class="empty-state"><span class="empty-icon">*</span><p>Sin datos de ventas en el periodo</p></div>'}
            </div>
        `;
    },

    _buildDayTable(porDia) {
        const entries = Object.entries(porDia).sort(([a], [b]) => b.localeCompare(a)); // más reciente primero
        if (!entries.length) return '<div class="empty-state"><span class="empty-icon">◰</span><p>Sin ventas en el periodo</p></div>';

        const maxVal   = Math.max(...entries.map(([, v]) => v), 1);
        const totalVal = entries.reduce((s, [, v]) => s + v, 0);

        const rows = entries.map(([dia, val]) => {
            const pct = Math.round((val / maxVal) * 100);
            const part = Math.round((val / totalVal) * 100);
            const [y, m, d] = dia.split('-');
            const fecha = new Date(parseInt(y), parseInt(m)-1, parseInt(d))
                .toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
            return `<tr>
                <td style="white-space:nowrap;font-weight:500">${fecha}</td>
                <td class="precio-cell">${Utils.currency(val)}</td>
                <td style="min-width:140px">
                    <div style="display:flex;align-items:center;gap:8px">
                        <div style="flex:1;height:7px;background:var(--gray-100);border-radius:4px;overflow:hidden">
                            <div style="width:${pct}%;height:100%;background:var(--black);border-radius:4px"></div>
                        </div>
                        <span style="font-size:.75rem;color:var(--gray-500);min-width:28px;text-align:right">${part}%</span>
                    </div>
                </td>
            </tr>`;
        }).join('');

        return `<div class="table-wrapper">
            <table class="table">
                <thead><tr><th>Fecha</th><th>Total del día</th><th>Participación</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr>
                    <td style="font-weight:600">Total</td>
                    <td class="precio-cell" style="font-weight:700">${Utils.currency(totalVal)}</td>
                    <td style="font-size:.78rem;color:var(--gray-500)">${entries.length} día(s) con ventas</td>
                </tr></tfoot>
            </table>
        </div>`;
    },

    async exportarCSV() {
        try {
            let header = [];
            let rows = [];
            let fileName = `${this._tab}_${this._desde}_${this._hasta}.csv`;

            if (this._tab === 'ventas') {
                const ventas = await this._getVentasFiltradas();
                header = ['ID', 'Fecha', 'Cliente', 'Items', 'Total', 'Estado', 'Notas'];
                rows = ventas.map(v => [
                    v.id,
                    Utils.date(v.fecha || v.created_at),
                    v.cliente_nombre || 'Consumidor final',
                    v.items_count || 0,
                    v.total,
                    v.estado,
                    v.notas || ''
                ]);
            } else if (this._tab === 'compras') {
                const compras = await this._getComprasFiltradas();
                header = ['ID', 'Fecha', 'Proveedor', 'Items', 'Total', 'Estado', 'Notas'];
                rows = compras.map(c => [
                    c.id,
                    Utils.date(c.fecha || c.created_at),
                    c.proveedor_nombre || 'Sin proveedor',
                    c.items_count || 0,
                    c.total,
                    c.estado,
                    c.notas || ''
                ]);
            } else if (this._tab === 'stock') {
                const productos = await SupabaseClient.select('productos', { select: 'codigo,nombre,stock,precio_compra,precio', order: 'stock.asc', activo: 'eq.true' });
                header = ['Codigo', 'Producto', 'Stock', 'Precio compra', 'Precio venta', 'Valor inventario'];
                rows = productos.map(p => [
                    p.codigo || '',
                    p.nombre || '',
                    p.stock || 0,
                    p.precio_compra || 0,
                    p.precio || 0,
                    (p.stock || 0) * parseFloat(p.precio_compra || 0)
                ]);
            } else {
                const ventas = await this._getVentasFiltradas();
                const ventasIds = ventas.filter(v => v.estado === 'completada').map(v => v.id);
                const items = ventasIds.length
                    ? await SupabaseClient.select('venta_items', { select: 'producto_nombre,cantidad,subtotal,venta_id', venta_id: `in.(${ventasIds.join(',')})` })
                    : [];
                const agregados = {};
                items.forEach(i => {
                    if (!agregados[i.producto_nombre]) agregados[i.producto_nombre] = { nombre: i.producto_nombre, unidades: 0, total: 0 };
                    agregados[i.producto_nombre].unidades += parseInt(i.cantidad || 0, 10);
                    agregados[i.producto_nombre].total += parseFloat(i.subtotal || 0);
                });
                header = ['Producto', 'Unidades', 'Total'];
                rows = Object.values(agregados).sort((a, b) => b.total - a.total).map(p => [p.nombre, p.unidades, p.total]);
            }

            const csv = [header, ...rows]
                .map(row => row.map(cell => Utils.csvCell(cell)).join(';'))
                .join('\r\n');

            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            Toast.success('CSV exportado correctamente');
        } catch (err) {
            Toast.error(err.message);
        }
    }
};
