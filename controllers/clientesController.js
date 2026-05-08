// ============================================================
// clientesController.js
// ============================================================
const ClientesController = {
    _clientes: [],
    _search: '',
    _showInactive: false,

    async render(view) {
        view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        this._clientes = await SupabaseClient.select('clientes', { select: '*', order: 'nombre.asc' }) || [];
        this._draw(view);
    },

    _draw(view) {
        const visibles = this._clientes.filter(c => this._showInactive || this.isActive(c));
        view.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h2>Clientes</h2>
                    <p>${visibles.length} cliente(s) visibles</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-outline btn-sm" onclick="ClientesController.toggleInactiveView()">${this._showInactive ? 'Ocultar inactivos' : 'Ver inactivos'}</button>
                    <button class="btn btn-primary" onclick="ClientesController.openForm()">
                        ${Utils.icon('plus')} Nuevo cliente
                    </button>
                </div>
            </div>
            <div class="productos-filters">
                <div class="search-bar" style="flex:1;max-width:420px">
                    <span class="search-icon">${Utils.icon('search', 16)}</span>
                    <input type="text" placeholder="Buscar por nombre, email o documento..."
                           value="${Utils.escape(this._search)}"
                           oninput="ClientesController.onSearch(this.value)"/>
                </div>
            </div>
            <div class="card" style="padding:0">
                <div class="table-wrapper" id="clientes-table">${this._buildTable()}</div>
            </div>
        `;
    },

    _filtered() {
        const base = this._clientes.filter(c => this._showInactive || this.isActive(c));
        if (!this._search) return base;
        const q = Utils.normalizeText(this._search);
        return base.filter(c =>
            Utils.normalizeText(c.nombre).includes(q) ||
            Utils.normalizeText(c.email).includes(q) ||
            Utils.normalizeText(c.documento).includes(q) ||
            Utils.normalizeText(c.telefono).includes(q)
        );
    },

    isActive(cliente) {
        return !Utils.hasInactiveMarker(cliente?.notas);
    },

    toggleInactiveView() {
        this._showInactive = !this._showInactive;
        this._draw(document.getElementById('app-view'));
    },

    _buildTable() {
        const rows = this._filtered();
        if (!rows.length) return '<div class="empty-state"><span class="empty-icon">()</span><p>No se encontraron clientes</p></div>';
        const body = rows.map(c => `<tr>
            <td><strong>${Utils.escape(c.nombre)}</strong>${!this.isActive(c) ? ' <span class="badge badge-danger">inactivo</span>' : ''}</td>
            <td>${Utils.escape(c.email || '-')}</td>
            <td>${Utils.escape(c.telefono || '-')}</td>
            <td>${Utils.escape(c.documento || '-')}</td>
            <td>${Utils.escape(Utils.truncate(c.direccion, 30))}</td>
            <td><div class="actions">
                <button class="btn btn-outline btn-sm btn-icon" onclick="ClientesController.openForm(${c.id})">${Utils.icon('edit', 14)}</button>
                <button class="btn btn-outline btn-sm btn-icon" onclick="ClientesController.verHistorial(${c.id})">${Utils.icon('eye', 14)}</button>
                <button class="btn btn-outline btn-sm" onclick="ClientesController.toggleActive(${c.id})">${this.isActive(c) ? 'Inactivar' : 'Activar'}</button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="ClientesController.confirmDelete(${c.id})">${Utils.icon('trash', 14)}</button>
            </div></td>
        </tr>`).join('');

        return `<table class="table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Telefono</th><th>Documento</th><th>Direccion</th><th></th></tr></thead>
            <tbody>${body}</tbody>
        </table>`;
    },

    onSearch: Utils.debounce(function(val) {
        ClientesController._search = val;
        const el = document.getElementById('clientes-table');
        if (el) el.innerHTML = ClientesController._buildTable();
    }, 300),

    openForm(id = null) {
        const c = id ? this._clientes.find(x => x.id === id) : {};
        const f = c || {};
        const active = this.isActive(f);
        Modal.open({
            title: id ? 'Editar cliente' : 'Nuevo cliente',
            size: 'md',
            body: `
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">Nombre</label>
                        <input class="form-input" id="c-nombre" value="${Utils.escape(f.nombre || '')}"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="c-email" value="${Utils.escape(f.email || '')}"/>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Telefono</label>
                        <input class="form-input" id="c-tel" value="${Utils.escape(f.telefono || '')}"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Documento (DNI/CUIT)</label>
                        <input class="form-input" id="c-doc" value="${Utils.escape(f.documento || '')}"/>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Direccion</label>
                    <input class="form-input" id="c-dir" value="${Utils.escape(f.direccion || '')}"/>
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea class="form-textarea" id="c-notas">${Utils.escape(Utils.stripInactiveMarker(f.notas || ''))}</textarea>
                </div>
            `,
            footer: `
                <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" onclick="ClientesController.save(${id || 'null'})">${id ? 'Guardar cambios' : 'Crear cliente'}</button>
            `
        });
    },

    _findDuplicate({ id = null, email = '', documento = '' }) {
        const emailNorm = Utils.normalizeText(email);
        const documentoNorm = Utils.normalizeText(documento);
        return this._clientes.find(c =>
            c.id !== id && (
                (emailNorm && Utils.normalizeText(c.email) === emailNorm) ||
                (documentoNorm && Utils.normalizeText(c.documento) === documentoNorm)
            )
        );
    },

    async save(id) {
        const nombre = document.getElementById('c-nombre').value.trim();
        const email = document.getElementById('c-email').value.trim();
        const documento = document.getElementById('c-doc').value.trim();
        if (!nombre) { Toast.warning('El nombre es obligatorio'); return; }

        const duplicate = this._findDuplicate({ id, email, documento });
        if (duplicate) {
            Toast.warning('Ya existe un cliente con ese email o documento');
            return;
        }

        const data = {
            nombre,
            email,
            telefono: document.getElementById('c-tel').value.trim(),
            documento,
            direccion: document.getElementById('c-dir').value.trim(),
            notas: Utils.withInactiveMarker(
                document.getElementById('c-notas').value.trim(),
                id ? !this.isActive(this._clientes.find(c => c.id === id)) : false
            )
        };
        try {
            if (id) {
                await SupabaseClient.update('clientes', id, data);
                Toast.success('Cliente actualizado');
            } else {
                await SupabaseClient.insert('clientes', data);
                Toast.success('Cliente creado');
            }
            Modal.close();
            this._clientes = await SupabaseClient.select('clientes', { select: '*', order: 'nombre.asc' }) || [];
            this._draw(document.getElementById('app-view'));
        } catch (err) { Toast.error(err.message); }
    },

    async toggleActive(id) {
        const cliente = this._clientes.find(c => c.id === id);
        if (!cliente) return;
        const willBeActive = !this.isActive(cliente);
        try {
            await SupabaseClient.update('clientes', id, {
                notas: Utils.withInactiveMarker(cliente.notas || '', !willBeActive)
            });
            Toast.success(`Cliente ${willBeActive ? 'activado' : 'inactivado'}`);
            this._clientes = await SupabaseClient.select('clientes', { select: '*', order: 'nombre.asc' }) || [];
            this._draw(document.getElementById('app-view'));
        } catch (err) { Toast.error(err.message); }
    },

    async verHistorial(clienteId) {
        const nombre = this._clientes.find(c => c.id === clienteId)?.nombre || '';
        try {
            const ventas = await SupabaseClient.select('ventas', {
                select: 'id,total,created_at,estado,items_count',
                cliente_id: `eq.${clienteId}`,
                order: 'created_at.desc',
                limit: 20
            });
            const totalAcum = ventas.filter(v => v.estado !== 'cancelada').reduce((s, v) => s + parseFloat(v.total || 0), 0);
            const rows = ventas.map(v => `<tr>
                <td>${Utils.date(v.created_at)}</td>
                <td>${v.items_count || 0} item(s)</td>
                <td>${Utils.currency(v.total)}</td>
                <td>${Utils.statusBadge(v.estado)}</td>
            </tr>`).join('');

            Modal.open({
                title: `Historial - ${nombre}`,
                size: 'md',
                body: `
                    <p style="margin-bottom:14px;font-size:.85rem;color:var(--gray-500)">
                        Total acumulado no cancelado: <strong style="color:var(--black)">${Utils.currency(totalAcum)}</strong> en ${ventas.length} venta(s)
                    </p>
                    <div class="table-wrapper">
                        <table class="table">
                            <thead><tr><th>Fecha</th><th>Items</th><th>Total</th><th>Estado</th></tr></thead>
                            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--gray-400)">Sin ventas</td></tr>'}</tbody>
                        </table>
                    </div>
                `
            });
        } catch (err) { Toast.error(err.message); }
    },

    confirmDelete(id) {
        const nombre = this._clientes.find(c => c.id === id)?.nombre || '';
        Modal.confirm({
            title: 'Eliminar cliente',
            message: `Eliminar a "${nombre}"?`,
            danger: true,
            onConfirm: async () => {
                try {
                    const ventas = await SupabaseClient.select('ventas', { select: 'id', cliente_id: `eq.${id}`, limit: 1 });
                    if (ventas.length) {
                        Toast.warning('No se puede eliminar un cliente con ventas asociadas');
                        return;
                    }
                    await SupabaseClient.delete('clientes', id);
                    Toast.success('Cliente eliminado');
                    this._clientes = await SupabaseClient.select('clientes', { select: '*', order: 'nombre.asc' }) || [];
                    this._draw(document.getElementById('app-view'));
                } catch (err) { Toast.error(err.message); }
            }
        });
    }
};
