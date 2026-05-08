// ============================================================
// dashboardController.js
// ============================================================
const DashboardController = {
    _mode: 'day',
    _customDate: null,
    _selectedMonth: new Date().getMonth() + 1,
    _selectedYear: new Date().getFullYear(),
    _listView: 'ventas',
    _ventasPeriodo: [],
    _comprasPeriodo: [],

    _MONTHS: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],

    _todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    _pad(n) { return String(n).padStart(2, '0'); },

    _getRange() {
        const today = this._todayStr();
        const now = new Date();

        if (this._mode === 'day') {
            const d = this._customDate || today;
            return { start: d, end: d };
        }
        if (this._mode === 'week') {
            const d = new Date(now);
            d.setDate(d.getDate() - 6);
            return {
                start: `${d.getFullYear()}-${this._pad(d.getMonth()+1)}-${this._pad(d.getDate())}`,
                end: today
            };
        }
        if (this._mode === 'month') {
            const y = this._selectedYear;
            const m = this._selectedMonth;
            const lastDay = new Date(y, m, 0).getDate();
            return { start: `${y}-${this._pad(m)}-01`, end: `${y}-${this._pad(m)}-${this._pad(lastDay)}` };
        }
        if (this._mode === 'year') {
            return { start: `${this._selectedYear}-01-01`, end: `${this._selectedYear}-12-31` };
        }
        return { start: today, end: today };
    },

    _modeLabel() {
        if (this._mode === 'month') return `de ${this._MONTHS[this._selectedMonth - 1]} ${this._selectedYear}`;
        if (this._mode === 'year') return `del año ${this._selectedYear}`;
        return { day: 'del día', week: 'de la semana' }[this._mode] || '';
    },

    _workdateLabelText() {
        const wd = WorkDate.get();
        const isToday = wd === this._todayStr();
        return isToday
            ? '<span style="color:var(--gray-400)">Registrando en: hoy</span>'
            : `<span style="color:#d97706">Registrando en: ${Utils.date(wd)}</span>`;
    },

    _syncWorkDate() {
        if (this._mode === 'day') {
            WorkDate.set(this._customDate);
        } else {
            WorkDate.reset();
        }
        const el = document.getElementById('dash-workdate-label');
        if (el) el.innerHTML = this._workdateLabelText();
    },

    _periodText() {
        const { start, end } = this._getRange();
        if (this._mode === 'day') return `Datos del ${start}`;
        if (start === end) return start;
        return `${start} — ${end}`;
    },

    _buildYearOptions() {
        const current = new Date().getFullYear();
        return Array.from({ length: 8 }, (_, i) => current - 5 + i)
            .map(y => `<option value="${y}" ${y === this._selectedYear ? 'selected' : ''}>${y}</option>`)
            .join('');
    },

    _buildMonthOptions() {
        return this._MONTHS.map((m, i) =>
            `<option value="${i + 1}" ${i + 1 === this._selectedMonth ? 'selected' : ''}>${m}</option>`
        ).join('');
    },

    async render(view) {
        view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        this._customDate = WorkDate.get();
        if (this._mode === 'day') WorkDate.set(this._customDate);

        try {
            const [productos, movimientos] = await Promise.all([
                SupabaseClient.select('productos', { select: 'id,nombre,stock', order: 'stock.asc', activo: 'eq.true' }),
                SupabaseClient.select('stock_movimientos', {
                    select: 'id,tipo,cantidad,producto_nombre,fecha,created_at',
                    order: 'fecha.desc.nullslast,created_at.desc',
                    limit: 6
                })
            ]);

            const stockBajo = productos.filter(p => (p.stock || 0) <= CONFIG.STOCK_MINIMO);

            view.innerHTML = `
                <div class="page-header">
                    <div class="page-header-left">
                        <h2>Dashboard</h2>
                        <p id="dash-period-label" style="color:var(--gray-500);font-size:.85rem">${this._periodText()}</p>
                        <p id="dash-workdate-label" style="font-size:.8rem;margin-top:2px">${this._workdateLabelText()}</p>
                    </div>
                    <div class="dash-filter-bar">
                        <div class="dash-mode-btns">
                            <button class="dash-mode-btn${this._mode==='day'   ?' active':''}" data-mode="day">Hoy</button>
                            <button class="dash-mode-btn${this._mode==='week'  ?' active':''}" data-mode="week">Semana</button>
                            <button class="dash-mode-btn${this._mode==='month' ?' active':''}" data-mode="month">Mes</button>
                            <button class="dash-mode-btn${this._mode==='year'  ?' active':''}" data-mode="year">Año</button>
                        </div>

                        <div id="dash-picker-day" style="display:${this._mode==='day'?'flex':'none'};align-items:center;gap:6px">
                            <input type="date" id="dash-date" class="dash-date-input" value="${this._customDate}" title="Elegir fecha"/>
                        </div>

                        <div id="dash-picker-month" style="display:${this._mode==='month'?'flex':'none'};gap:6px;align-items:center">
                            <select id="dash-sel-month" class="dash-date-input" style="min-width:110px">
                                ${this._buildMonthOptions()}
                            </select>
                            <select id="dash-sel-year-m" class="dash-date-input">
                                ${this._buildYearOptions()}
                            </select>
                        </div>

                        <div id="dash-picker-year" style="display:${this._mode==='year'?'flex':'none'};align-items:center;gap:6px">
                            <select id="dash-sel-year" class="dash-date-input">
                                ${this._buildYearOptions()}
                            </select>
                        </div>

                        <button id="dash-apply-btn" class="btn btn-primary btn-sm" style="display:${this._mode!=='week'?'':'none'}" onclick="DashboardController._updateStats()">Aplicar</button>
                    </div>
                </div>

                <div id="dash-stats" class="stats-grid">
                    <div class="stat-card" style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:80px">
                        <div class="spinner"></div>
                    </div>
                </div>

                <div class="dashboard-grid">
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title" id="dash-ventas-title">${this._listView === 'ventas' ? 'Ventas' : 'Compras'} ${this._modeLabel()}</span>
                            <button id="dash-toggle-list-btn" class="btn btn-outline btn-sm" onclick="DashboardController._switchListView(DashboardController._listView === 'ventas' ? 'compras' : 'ventas')">${this._listView === 'ventas' ? 'Ver compras' : 'Ver ventas'}</button>
                        </div>
                        <div id="dash-ventas-list"><div class="page-loading"><div class="spinner"></div></div></div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:20px">
                        <div class="card">
                            <div class="card-header">
                                <span class="card-title">⚠ Stock bajo</span>
                                <button class="btn btn-outline btn-sm" onclick="Router.navigate('/stock')">Ver stock</button>
                            </div>
                            ${this._renderStockAlertas(stockBajo)}
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <span class="card-title">Movimientos recientes</span>
                            </div>
                            ${this._renderMovimientos(movimientos)}
                        </div>
                    </div>
                </div>
            `;

            this._wireEvents();
            await this._updateStats();

        } catch (err) {
            view.innerHTML = `<div class="page-error"><h3>Error al cargar dashboard</h3><p>${err.message}</p></div>`;
        }
    },

    _wireEvents() {
        // Botones de modo
        document.querySelectorAll('.dash-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._mode = btn.dataset.mode;
                document.querySelectorAll('.dash-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
                this._showPicker(this._mode);
                const applyBtn = document.getElementById('dash-apply-btn');
                if (applyBtn) applyBtn.style.display = this._mode === 'week' ? 'none' : '';
                this._syncWorkDate();
                this._updateStats();
            });
        });

        // Picker día — guarda el valor y sincroniza WorkDate (el botón Aplicar dispara la carga)
        document.getElementById('dash-date')?.addEventListener('change', e => {
            this._customDate = e.target.value;
            this._mode = 'day';
            document.querySelectorAll('.dash-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'day'));
            this._syncWorkDate();
        });

        // Picker mes
        document.getElementById('dash-sel-month')?.addEventListener('change', e => {
            this._selectedMonth = parseInt(e.target.value);
        });
        document.getElementById('dash-sel-year-m')?.addEventListener('change', e => {
            this._selectedYear = parseInt(e.target.value);
        });

        // Picker año
        document.getElementById('dash-sel-year')?.addEventListener('change', e => {
            this._selectedYear = parseInt(e.target.value);
        });
    },

    _showPicker(mode) {
        const pickers = { day: 'dash-picker-day', month: 'dash-picker-month', year: 'dash-picker-year' };
        Object.entries(pickers).forEach(([m, id]) => {
            const el = document.getElementById(id);
            if (el) el.style.display = (m === mode) ? 'flex' : 'none';
        });
    },

    async _updateStats() {
        const { start, end } = this._getRange();
        const label = document.getElementById('dash-period-label');
        const ventasTitle = document.getElementById('dash-ventas-title');
        if (label) label.textContent = this._periodText();
        if (ventasTitle) ventasTitle.textContent = `Ventas ${this._modeLabel()}`;

        const statsEl = document.getElementById('dash-stats');
        const ventasListEl = document.getElementById('dash-ventas-list');

        if (statsEl) statsEl.innerHTML = `
            <div class="stat-card" style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:80px">
                <div class="spinner"></div>
            </div>`;

        try {
            const orFilter = Utils.buildDateOrFilter(start, end);
            const [ventas, compras] = await Promise.all([
                SupabaseClient.select('ventas', {
                    select: 'id,total,estado,fecha,created_at,cliente_nombre',
                    order: 'created_at.desc',
                    or: orFilter
                }),
                SupabaseClient.select('compras', {
                    select: 'id,total,estado,fecha,created_at,proveedor_nombre',
                    order: 'created_at.desc',
                    or: orFilter
                })
            ]);

            // Client-side refinement: ensure the date range is respected using fecha (if set) or created_at date
            const inRange = (row) => {
                const d = Utils.effectiveDate(row);
                return d >= start && d <= end;
            };
            ventas.splice(0, ventas.length, ...ventas.filter(inRange));
            compras.splice(0, compras.length, ...compras.filter(inRange));

            const ventasComp  = ventas.filter(v => v.estado === 'completada');
            const comprasRec  = compras.filter(c => c.estado === 'recibida');
            const totalVentas = ventasComp.reduce((s, v) => s + parseFloat(v.total || 0), 0);
            const totalCompras = comprasRec.reduce((s, c) => s + parseFloat(c.total || 0), 0);
            const ml = this._modeLabel();

            this._ventasPeriodo = ventas;
            this._comprasPeriodo = compras;

            if (statsEl) {
                statsEl.innerHTML = `
                    <div class="stat-card accent">
                        <span class="stat-label">Ventas netas ${ml}</span>
                        <span class="stat-value">${Utils.currency(totalVentas)}</span>
                        <span class="stat-change">${ventasComp.length} completada(s) de ${ventas.length}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Compras ${ml}</span>
                        <span class="stat-value">${Utils.currency(totalCompras)}</span>
                        <span class="stat-change">${comprasRec.length} recibida(s) de ${compras.length}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Diferencia ${ml}</span>
                        <span class="stat-value" style="color:${totalVentas - totalCompras >= 0 ? '#16a34a' : '#dc2626'}">${Utils.currency(totalVentas - totalCompras)}</span>
                        <span class="stat-change">ventas − compras</span>
                    </div>
                `;
            }

            if (ventasListEl) {
                ventasListEl.innerHTML = this._listView === 'ventas'
                    ? this._renderRecentVentas(ventas.slice(0, 10))
                    : this._renderRecentCompras(compras.slice(0, 10));
            }

        } catch (err) {
            if (statsEl) statsEl.innerHTML = `<div class="page-error" style="grid-column:1/-1"><p>Error: ${Utils.escape(err.message)}</p></div>`;
        }
    },

    _switchListView(view) {
        this._listView = view;
        const listEl = document.getElementById('dash-ventas-list');
        const titleEl = document.getElementById('dash-ventas-title');
        const toggleBtn = document.getElementById('dash-toggle-list-btn');
        if (listEl) {
            listEl.innerHTML = view === 'ventas'
                ? this._renderRecentVentas((this._ventasPeriodo || []).slice(0, 10))
                : this._renderRecentCompras((this._comprasPeriodo || []).slice(0, 10));
        }
        if (titleEl) titleEl.textContent = `${view === 'ventas' ? 'Ventas' : 'Compras'} ${this._modeLabel()}`;
        if (toggleBtn) toggleBtn.textContent = view === 'ventas' ? 'Ver compras' : 'Ver ventas';
    },

    _renderRecentVentas(ventas) {
        if (!ventas.length) return '<div class="empty-state"><span class="empty-icon">◎</span><p>Sin ventas en este período</p></div>';
        return `<div class="recent-list">${ventas.map(v => `
            <div class="recent-item">
                <div class="recent-item-left">
                    <span class="recent-item-title">${Utils.escape(v.cliente_nombre || 'Consumidor final')}</span>
                    <span class="recent-item-sub">${v.fecha ? Utils.date(v.fecha) : Utils.datetime(v.created_at)}</span>
                </div>
                <span class="recent-item-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
                    ${Utils.currency(v.total)}
                    ${Utils.statusBadge(v.estado)}
                </span>
            </div>
        `).join('')}</div>`;
    },

    _renderRecentCompras(compras) {
        if (!compras.length) return '<div class="empty-state"><span class="empty-icon">◎</span><p>Sin compras en este período</p></div>';
        return `<div class="recent-list">${compras.map(c => `
            <div class="recent-item">
                <div class="recent-item-left">
                    <span class="recent-item-title">${Utils.escape(c.proveedor_nombre || 'Sin proveedor')}</span>
                    <span class="recent-item-sub">${c.fecha ? Utils.date(c.fecha) : Utils.datetime(c.created_at)}</span>
                </div>
                <span class="recent-item-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
                    ${Utils.currency(c.total)}
                    ${Utils.statusBadge(c.estado)}
                </span>
            </div>
        `).join('')}</div>`;
    },

    _renderStockAlertas(items) {
        if (!items.length) return '<p style="color:#16a34a;font-size:.85rem;padding:8px 0">✓ Todo el stock en niveles normales</p>';
        return items.slice(0, 6).map(p => `
            <div class="alert-item">
                <strong>${Utils.escape(Utils.truncate(p.nombre, 28))}</strong>
                <span>${p.stock} unid.</span>
            </div>
        `).join('');
    },

    verVentasPeriodo() {
        const { start, end } = this._getRange();
        VentasController._filters.desde = start;
        VentasController._filters.hasta = end;
        Router.navigate('/ventas');
    },

    verComprasPeriodo() {
        const { start, end } = this._getRange();
        ComprasController._filters.desde = start;
        ComprasController._filters.hasta = end;
        Router.navigate('/compras');
    },

    _renderMovimientos(movs) {
        if (!movs.length) return '<div class="empty-state"><span class="empty-icon">≡</span><p>Sin movimientos</p></div>';
        return `<div class="recent-list">${movs.map(m => `
            <div class="recent-item">
                <div class="recent-item-left">
                    <span class="recent-item-title">${Utils.escape(Utils.truncate(m.producto_nombre, 26))}</span>
                    <span class="recent-item-sub">${m.fecha ? Utils.date(m.fecha) : Utils.datetime(m.created_at)}</span>
                </div>
                <span class="tipo-badge tipo-${m.tipo}">${m.tipo} ${m.cantidad > 0 ? '+' : ''}${m.cantidad}</span>
            </div>
        `).join('')}</div>`;
    }
};
