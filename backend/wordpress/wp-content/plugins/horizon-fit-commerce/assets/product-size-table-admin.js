(() => {
  'use strict';

  const DEFAULT_TABLE = {
    title: 'Tabla de talles',
    headers: ['Talle', 'Busto', 'Cintura', 'Cadera'],
    rows: [
      ['S', '84-90', '64-70', '90-96'],
      ['M', '90-96', '70-76', '96-102'],
      ['L', '96-104', '76-84', '102-110']
    ]
  };

  const init = () => {
    const editor = document.querySelector('[data-hf-size-table-editor]');
    if (!editor) return;

    const grid = editor.querySelector('[data-hf-size-table-grid]');
    const title = editor.querySelector('[data-hf-size-table-title]');
    const output = editor.querySelector('[data-hf-size-table-json]');
    const body = grid?.tBodies?.[0];
    if (!grid || !title || !output || !body) return;

    const headerCells = () => Array.from(grid.tHead.rows[0].querySelectorAll('th:not(.hf-size-table-editor__actions)'));
    const columnCount = () => headerCells().length;

    const createHeader = (value = 'Medida') => {
      const cell = document.createElement('th');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value;
      input.setAttribute('aria-label', 'Nombre de columna');
      input.setAttribute('data-hf-size-header', '');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button-link-delete';
      remove.setAttribute('aria-label', 'Eliminar columna');
      remove.setAttribute('data-hf-remove-column', '');
      remove.textContent = '×';
      cell.append(input, remove);
      return cell;
    };

    const createRow = (values = []) => {
      const row = document.createElement('tr');
      for (let index = 0; index < columnCount(); index += 1) {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = values[index] || '';
        input.setAttribute('data-hf-size-cell', '');
        cell.appendChild(input);
        row.appendChild(cell);
      }
      const actions = document.createElement('td');
      actions.className = 'hf-size-table-editor__actions';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button-link-delete';
      remove.setAttribute('data-hf-remove-row', '');
      remove.textContent = 'Eliminar';
      actions.appendChild(remove);
      row.appendChild(actions);
      return row;
    };

    const serialize = () => {
      const headers = headerCells().map(cell => cell.querySelector('[data-hf-size-header]')?.value.trim() || '');
      const rows = Array.from(body.rows).map(row =>
        Array.from(row.querySelectorAll('[data-hf-size-cell]')).map(input => input.value.trim())
      );
      output.value = JSON.stringify({ title: title.value.trim() || 'Tabla de talles', headers, rows });
    };

    const render = (table) => {
      title.value = table.title || 'Tabla de talles';
      const actions = grid.tHead.rows[0].querySelector('.hf-size-table-editor__actions');
      headerCells().forEach(cell => cell.remove());
      (table.headers || []).slice(0, 8).forEach(header => actions.before(createHeader(header)));
      body.replaceChildren();
      (table.rows || []).slice(0, 30).forEach(row => body.appendChild(createRow(row)));
      serialize();
    };

    editor.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest('[data-hf-add-column]')) {
        if (columnCount() >= 8) return;
        const actions = grid.tHead.rows[0].querySelector('.hf-size-table-editor__actions');
        actions.before(createHeader());
        Array.from(body.rows).forEach(row => {
          const cell = document.createElement('td');
          const input = document.createElement('input');
          input.type = 'text';
          input.setAttribute('data-hf-size-cell', '');
          cell.appendChild(input);
          row.lastElementChild.before(cell);
        });
      } else if (target.closest('[data-hf-add-row]')) {
        if (body.rows.length < 30) body.appendChild(createRow());
      } else if (target.closest('[data-hf-remove-column]')) {
        if (columnCount() <= 1) return;
        const header = target.closest('th');
        const index = headerCells().indexOf(header);
        header.remove();
        Array.from(body.rows).forEach(row => row.cells[index]?.remove());
      } else if (target.closest('[data-hf-remove-row]')) {
        target.closest('tr')?.remove();
      } else if (target.closest('[data-hf-reset-table]')) {
        render(DEFAULT_TABLE);
      } else {
        return;
      }
      serialize();
    });

    editor.addEventListener('input', serialize);
    editor.closest('form')?.addEventListener('submit', serialize);
    serialize();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
