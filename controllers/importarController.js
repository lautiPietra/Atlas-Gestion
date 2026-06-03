// ============================================================
// importarController.js — Importación masiva de productos desde Excel/CSV
// ============================================================
const ImportarController = {
    _mapped: [],
    _importing: false,

    // Aliases de columnas aceptados (normalizados, sin tildes, minúsculas)
    _COLS: {
        codigo:        ['codigo', 'code', 'cod', 'sku'],
        nombre:        ['nombre', 'name', 'producto', 'articulo', 'item'],
        descripcion:   ['descripcion', 'description', 'detalle', 'desc'],
        categoria:     ['categoria', 'category', 'cat', 'rubro'],
        precio_compra: ['precio_compra', 'precio compra', 'costo', 'cost', 'precio de compra'],
        precio:        ['precio', 'precio_venta', 'precio venta', 'pvp', 'price', 'precio de venta'],
        stock:         ['stock', 'cantidad', 'quantity', 'qty', 'inventario', 'existencia', 'existencias']
    },

    async render(view) {
        this._mapped = [];
        this._importing = false;
        this._draw(view);
    },

    _draw(view) {
        view.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h2>Importar productos</h2>
                    <p>Cargá un archivo Excel o CSV para agregar productos en bloque</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-outline btn-sm" onclick="ImportarController.descargarPlantilla()">
                        ⬇ Descargar plantilla CSV
                    </button>
                </div>
            </div>

            <div class="card" style="margin-bottom:20px">
                <h3 style="margin:0 0 8px;font-size:15px;font-weight:600">1. Seleccioná tu archivo</h3>
                <p style="margin:0 0 16px;color:var(--gray-500);font-size:13px">
                    Columnas reconocidas: <strong>nombre</strong> (obligatorio), codigo, descripcion, categoria, precio_compra, precio, stock.<br>
                    El orden de las columnas no importa. Las columnas desconocidas se ignoran.
                </p>
                <div id="import-dropzone" class="import-dropzone"
                     onclick="document.getElementById('import-file').click()"
                     ondragover="ImportarController.onDragOver(event)"
                     ondragleave="ImportarController.onDragLeave(event)"
                     ondrop="ImportarController.onDrop(event)">
                    <div class="import-dropzone-icon">📂</div>
                    <div class="import-dropzone-text">Hacé clic o arrastrá un archivo aquí</div>
                    <div class="import-dropzone-sub">Formatos soportados: .xlsx, .xls, .csv</div>
                    <input type="file" id="import-file" accept=".xlsx,.xls,.csv" style="display:none"
                           onchange="ImportarController.onFileChange(event)"/>
                </div>
            </div>

            <div id="import-preview"></div>
            <div id="import-actions"></div>
        `;
    },

    onDragOver(e) {
        e.preventDefault();
        document.getElementById('import-dropzone').classList.add('dragover');
    },

    onDragLeave() {
        document.getElementById('import-dropzone').classList.remove('dragover');
    },

    onDrop(e) {
        e.preventDefault();
        document.getElementById('import-dropzone').classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) this._processFile(file);
    },

    onFileChange(e) {
        const file = e.target.files[0];
        if (file) this._processFile(file);
    },

    _processFile(file) {
        if (typeof XLSX === 'undefined') {
            Toast.error('La librería de Excel no cargó. Verificá tu conexión a internet y recargá la página.');
            return;
        }
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            Toast.error('Formato no soportado. Usá .xlsx, .xls o .csv');
            return;
        }

        const dz = document.getElementById('import-dropzone');
        dz.querySelector('.import-dropzone-text').textContent = `📄 ${file.name}`;
        dz.querySelector('.import-dropzone-sub').textContent = `${(file.size / 1024).toFixed(1)} KB — procesando...`;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                if (!rows.length) {
                    Toast.warning('El archivo está vacío');
                    dz.querySelector('.import-dropzone-sub').textContent = 'Ninguna fila encontrada';
                    return;
                }

                this._parseRows(rows);
                dz.querySelector('.import-dropzone-sub').textContent = `${rows.length} fila(s) leída(s)`;
            } catch (err) {
                Toast.error('No se pudo leer el archivo: ' + err.message);
                dz.querySelector('.import-dropzone-sub').textContent = 'Error al procesar el archivo';
            }
        };
        reader.readAsArrayBuffer(file);
    },

    _mapHeader(h) {
        const norm = Utils.normalizeText(String(h)).replace(/\s+/g, ' ').trim();
        for (const [field, aliases] of Object.entries(this._COLS)) {
            if (aliases.includes(norm)) return field;
        }
        return null;
    },

    _parseRows(rawRows) {
        // Mapear claves del Excel → campos internos
        const headerMap = {};
        for (const key of Object.keys(rawRows[0] || {})) {
            const field = this._mapHeader(key);
            if (field) headerMap[key] = field;
        }

        const mapped = rawRows.map((row, i) => {
            const obj = { _row: i + 2 };
            for (const [rawKey, field] of Object.entries(headerMap)) {
                obj[field] = row[rawKey];
            }

            obj._errors = [];

            // nombre: obligatorio
            const nombre = String(obj.nombre || '').trim();
            if (!nombre) obj._errors.push('nombre vacío');
            obj.nombre = nombre;

            // campos de texto opcionales
            obj.codigo      = String(obj.codigo      || '').trim() || null;
            obj.descripcion = String(obj.descripcion || '').trim() || null;
            obj.categoria   = String(obj.categoria   || '').trim() || null;

            // precios
            const parseNum = (v) => {
                if (v === '' || v == null) return 0;
                const n = parseFloat(String(v).replace(',', '.'));
                return Number.isNaN(n) ? null : n;
            };
            obj.precio_compra = parseNum(obj.precio_compra);
            obj.precio        = parseNum(obj.precio);
            if (obj.precio_compra === null) obj._errors.push('precio de compra inválido');
            else if (obj.precio_compra < 0)  obj._errors.push('precio de compra negativo');
            if (obj.precio === null)          obj._errors.push('precio de venta inválido');
            else if (obj.precio < 0)          obj._errors.push('precio de venta negativo');

            // stock
            const stockRaw = obj.stock;
            if (stockRaw === '' || stockRaw == null) {
                obj.stock = 0;
            } else {
                const n = parseInt(String(stockRaw), 10);
                if (Number.isNaN(n) || n < 0) obj._errors.push('stock inválido');
                else obj.stock = n;
            }

            return obj;
        });

        this._mapped = mapped;
        this._drawPreview();
    },

    _drawPreview() {
        const mapped = this._mapped;
        const valid   = mapped.filter(r => r._errors.length === 0);
        const invalid = mapped.filter(r => r._errors.length > 0);

        const bodyRows = mapped.map(r => {
            const hasErr = r._errors.length > 0;
            const rowStyle = hasErr ? 'background:#fff5f5' : '';
            const errNote = hasErr
                ? `<br><small style="color:#dc2626;font-size:11px">${r._errors.join(', ')}</small>` : '';
            const leftBorder = hasErr ? 'border-left:3px solid #dc2626' : 'border-left:3px solid #16a34a';
            return `<tr style="${rowStyle}">
                <td style="color:var(--gray-400);font-size:12px;${leftBorder}">${r._row}</td>
                <td><strong>${Utils.escape(r.nombre || '')}</strong>${errNote}</td>
                <td>${Utils.escape(r.codigo || '')}</td>
                <td>${Utils.escape(r.categoria || '')}</td>
                <td>${r.precio_compra != null ? Utils.currency(r.precio_compra) : '<span style="color:#dc2626">?</span>'}</td>
                <td>${r.precio        != null ? Utils.currency(r.precio)        : '<span style="color:#dc2626">?</span>'}</td>
                <td>${typeof r.stock === 'number' ? r.stock : '<span style="color:#dc2626">?</span>'}</td>
            </tr>`;
        }).join('');

        document.getElementById('import-preview').innerHTML = `
            <div class="card" style="margin-bottom:20px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
                    <h3 style="margin:0;font-size:15px;font-weight:600">
                        2. Vista previa — ${mapped.length} fila${mapped.length !== 1 ? 's' : ''}
                    </h3>
                    <div style="display:flex;gap:6px">
                        <span style="background:#dcfce7;color:#15803d;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600">
                            ${valid.length} válido${valid.length !== 1 ? 's' : ''}
                        </span>
                        ${invalid.length ? `<span style="background:#fee2e2;color:#dc2626;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600">
                            ${invalid.length} con error
                        </span>` : ''}
                    </div>
                </div>
                <div class="table-wrapper" style="max-height:360px;overflow-y:auto">
                    <table class="table">
                        <thead><tr>
                            <th style="width:50px">Fila</th>
                            <th>Nombre</th>
                            <th>Codigo</th>
                            <th>Categoria</th>
                            <th>P. Compra</th>
                            <th>P. Venta</th>
                            <th>Stock</th>
                        </tr></thead>
                        <tbody>${bodyRows}</tbody>
                    </table>
                </div>
                ${invalid.length ? `<p style="margin:10px 0 0;font-size:13px;color:#b45309">
                    ⚠ Las ${invalid.length} fila${invalid.length !== 1 ? 's' : ''} con error serán omitidas.
                    Corregí el archivo y volvé a cargarlo si querés incluirlas.
                </p>` : ''}
            </div>
        `;

        if (valid.length > 0) {
            document.getElementById('import-actions').innerHTML = `
                <div style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:32px">
                    <button class="btn btn-outline" onclick="ImportarController.reset()">Cancelar</button>
                    <button class="btn btn-primary" id="import-btn" onclick="ImportarController.doImport()">
                        Importar ${valid.length} producto${valid.length !== 1 ? 's' : ''}
                    </button>
                </div>
            `;
        } else {
            document.getElementById('import-actions').innerHTML = `
                <p style="text-align:center;color:#dc2626;font-size:14px;margin-bottom:32px">
                    No hay filas válidas para importar. Revisá el archivo y volvé a cargarlo.
                </p>
            `;
        }
    },

    reset() {
        const view = document.getElementById('app-view');
        if (view) this.render(view);
    },

    async doImport() {
        if (this._importing) return;
        const validRows = this._mapped.filter(r => r._errors.length === 0);
        if (!validRows.length) return;

        this._importing = true;
        const btn = document.getElementById('import-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Importando...'; }

        let ok = 0, fail = 0;

        for (let i = 0; i < validRows.length; i++) {
            if (btn) btn.textContent = `Importando ${i + 1} de ${validRows.length}...`;

            const r = validRows[i];
            const data = {
                nombre:        r.nombre,
                precio_compra: r.precio_compra || 0,
                precio:        r.precio        || 0,
                stock:         r.stock         || 0
            };
            if (r.codigo)      data.codigo      = r.codigo;
            if (r.descripcion) data.descripcion = r.descripcion;
            if (r.categoria)   data.categoria   = r.categoria;

            try {
                await SupabaseClient.insert('productos', data);
                ok++;
            } catch {
                fail++;
            }
        }

        this._importing = false;

        if (ok > 0)   Toast.success(`${ok} producto${ok !== 1 ? 's' : ''} importado${ok !== 1 ? 's' : ''} correctamente`);
        if (fail > 0) Toast.error(`${fail} fila${fail !== 1 ? 's' : ''} no se pudieron importar (duplicados u otro error)`);

        setTimeout(() => this.reset(), 1200);
    },

    descargarPlantilla() {
        const csv = '﻿'
            + 'nombre;codigo;descripcion;categoria;precio_compra;precio;stock\n'
            + 'Camiseta blanca;SKU-001;Algodón 100%;Ropa;500;800;20\n'
            + 'Pantalón negro;SKU-002;;Ropa;700;1200;15\n'
            + 'Zapatillas running;SKU-003;Talle 42;Calzado;3000;5500;8\n';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'plantilla-importar-productos.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
