window.DeskDragManager = {
  createInitialState() {
    return {
      topZIndex: 20,
      activeDocKey: null,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      documents: {
        passport: {
          x: 22,
          y: 26,
          z: 15,
          rotation: -2,
          isDragging: false
        },
        manifest: {
          x: 185,
          y: 165,
          z: 14,
          rotation: 2.5,
          isDragging: false
        }
      }
    };
  },

  resetPositions(dragState) {
    dragState.topZIndex = 20;
    dragState.activeDocKey = null;
    dragState.documents.passport = {
      x: 20 + Math.floor(Math.random() * 14),
      y: 22 + Math.floor(Math.random() * 14),
      z: 16,
      rotation: -2.2,
      isDragging: false
    };
    dragState.documents.manifest = {
      x: 170 + Math.floor(Math.random() * 18),
      y: 150 + Math.floor(Math.random() * 18),
      z: 15,
      rotation: 2.8,
      isDragging: false
    };
  },

  bringToFront(dragState, docKey) {
    const targetDoc = dragState.documents[docKey];
    if (!targetDoc) return;
    dragState.topZIndex += 1;
    targetDoc.z = dragState.topZIndex;
  },

  beginDrag(event, dragState, docKey, deskElement) {
    const targetDoc = dragState.documents[docKey];
    if (!targetDoc || !deskElement) return;
    this.bringToFront(dragState, docKey);
    targetDoc.isDragging = true;
    dragState.activeDocKey = docKey;

    const deskRect = deskElement.getBoundingClientRect();
    dragState.pointerOffsetX = event.clientX - deskRect.left - targetDoc.x;
    dragState.pointerOffsetY = event.clientY - deskRect.top - targetDoc.y;

    if (event.currentTarget && event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (err) {}
    }

    if (window.ProceduralAudioEngine) {
      window.ProceduralAudioEngine.playPaperRustle();
    }
  },

  updateDrag(event, dragState, deskElement, docElement) {
    const activeKey = dragState.activeDocKey;
    if (!activeKey || !deskElement) return;
    const targetDoc = dragState.documents[activeKey];
    if (!targetDoc || !targetDoc.isDragging) return;

    const deskRect = deskElement.getBoundingClientRect();
    const docWidth = docElement ? docElement.offsetWidth : 310;
    const docHeight = docElement ? docElement.offsetHeight : 250;

    const rawX = event.clientX - deskRect.left - dragState.pointerOffsetX;
    const rawY = event.clientY - deskRect.top - dragState.pointerOffsetY;

    const maxX = Math.max(8, deskRect.width - docWidth - 8);
    const maxY = Math.max(8, deskRect.height - docHeight - 8);

    targetDoc.x = Math.min(Math.max(8, rawX), maxX);
    targetDoc.y = Math.min(Math.max(8, rawY), maxY);
  },

  endDrag(event, dragState) {
    const activeKey = dragState.activeDocKey;
    if (!activeKey) return;
    const targetDoc = dragState.documents[activeKey];
    if (targetDoc) {
      targetDoc.isDragging = false;
    }
    dragState.activeDocKey = null;
    if (event && event.currentTarget && event.currentTarget.releasePointerCapture) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (err) {}
    }
  },

  buildDocumentInlineStyle(docState) {
    if (!docState) return '';
    const scaleValue = docState.isDragging ? 1.02 : 1.0;
    return `left: ${docState.x}px; top: ${docState.y}px; z-index: ${docState.z}; transform: rotate(${docState.rotation}deg) scale(${scaleValue});`;
  }
};
