export { findNode, type StoreDocument, type DesignNode, type DesignOperation, type DesignStyle } from '../../src/platform/document';
import type { Block } from '../../src/platform/document';
export function renderPlaceholder(id: string): Block { return { id, name: 'Nueva sección', type: 'content', visible: true, nodes: [{ id: `${id}-title`, parentId: null, tag: 'h2', text: 'Una nueva historia.', style: { fontSize: 36 }, mobile: { fontSize: 28 } }, { id: `${id}-body`, parentId: null, tag: 'p', text: 'Seleccioná este texto para empezar a editar.', style: {}, mobile: {} }] }; }
