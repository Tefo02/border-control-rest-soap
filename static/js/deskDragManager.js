window.DeskDragManager = {
  createInitialState() {
    return {
      topZIndex: 30,
      activeDocKey: null,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      isHoveringReturnSlot: false,
      isPassportInStampBay: false,
      documents: {
        rulebook: {
          x: 16,
          y: 66,
          z: 12,
          rotation: -1.5,
          isDragging: false,
          returned: false
        },
        passport: {
          x: 145,
          y: 56,
          z: 22,
          rotation: -1.8,
          isDragging: false,
          returned: false
        },
        manifest: {
          x: 390,
          y: 78,
          z: 20,
          rotation: 2.2,
          isDragging: false,
          returned: false
        },
        soapPrintout: {
          x: 590,
          y: 52,
          z: 25,
          rotation: -0.8,
          isDragging: false,
          returned: false
        },
        interpolSlip: {
          x: 470,
          y: 125,
          z: 24,
          rotation: 1.5,
          isDragging: false,
          returned: false
        }
      }
    };
  },

  resetTravelerDocuments(dragState) {
    dragState.activeDocKey = null;
    dragState.isHoveringReturnSlot = false;
    dragState.isPassportInStampBay = false;
    dragState.documents.passport = {
      x: 135 + Math.floor(Math.random() * 20),
      y: 54 + Math.floor(Math.random() * 12),
      z: dragState.topZIndex + 2,
      rotation: -1.8,
      isDragging: false,
      returned: false
    };
    dragState.documents.manifest = {
      x: 380 + Math.floor(Math.random() * 20),
      y: 72 + Math.floor(Math.random() * 14),
      z: dragState.topZIndex + 1,
      rotation: 2.1,
      isDragging: false,
      returned: false
    };
    dragState.topZIndex += 3;
  },

  spawnSoapPrintoutPosition(dragState, deskWidth) {
    dragState.topZIndex += 1;
    const targetX = deskWidth ? Math.max(280, Math.min(deskWidth - 620, 560)) : 540;
    dragState.documents.soapPrintout = {
      x: targetX + Math.floor(Math.random() * 14),
      y: 50,
      z: dragState.topZIndex,
      rotation: -0.6,
      isDragging: false,
      returned: false
    };
  },

  spawnInterpolSlipPosition(dragState) {
    dragState.topZIndex += 1;
    dragState.documents.interpolSlip = {
      x: 455 + Math.floor(Math.random() * 16),
      y: 110,
      z: dragState.topZIndex,
      rotation: 1.4,
      isDragging: false,
      returned: false
    };
  },

  movePassportIntoStampBay(dragState, deskElement) {
    const deskWidth = deskElement ? deskElement.getBoundingClientRect().width : 1100;
    const passportDoc = dragState.documents.passport;
    dragState.topZIndex += 1;
    passportDoc.z = dragState.topZIndex;
    passportDoc.x = Math.max(300, deskWidth - 345);
    passportDoc.y = 95;
    passportDoc.rotation = 0;
    dragState.isPassportInStampBay = true;
  },

  evaluateZones(dragState, deskRect) {
    const passportDoc = dragState.documents.passport;
    if (passportDoc && deskRect) {
      const bayLeftEdge = deskRect.width - 375;
      dragState.isPassportInStampBay = passportDoc.x >= bayLeftEdge && passportDoc.y >= 42;
    }
    const activeKey = dragState.activeDocKey;
    if (activeKey === 'passport' || activeKey === 'manifest') {
      const activeDoc = dragState.documents[activeKey];
      dragState.isHoveringReturnSlot = activeDoc.y <= 38 && activeDoc.x <= 560;
    } else {
      dragState.isHoveringReturnSlot = false;
    }
  },

  bringToFront(dragState, docKey) {
    const targetDoc = dragState.documents[docKey];
    if (!targetDoc) return;
    dragState.topZIndex += 1;
    targetDoc.z = dragState.topZIndex;
  },

  beginDrag(event, dragState, docKey, deskElement) {
    const targetDoc = dragState.documents[docKey];
    if (!targetDoc || !deskElement || targetDoc.returned) return;
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
    const docWidth = docElement ? docElement.offsetWidth : 280;
    const docHeight = docElement ? docElement.offsetHeight : 210;

    const rawX = event.clientX - deskRect.left - dragState.pointerOffsetX;
    const rawY = event.clientY - deskRect.top - dragState.pointerOffsetY;

    const maxX = Math.max(8, deskRect.width - docWidth - 8);
    const maxY = Math.max(6, deskRect.height - docHeight - 6);

    targetDoc.x = Math.min(Math.max(8, rawX), maxX);
    targetDoc.y = Math.min(Math.max(6, rawY), maxY);

    this.evaluateZones(dragState, deskRect);
  },

  endDrag(event, dragState, deskElement) {
    const activeKey = dragState.activeDocKey;
    if (!activeKey) return null;
    const targetDoc = dragState.documents[activeKey];
    if (targetDoc) {
      targetDoc.isDragging = false;
    }
    const droppedInSlot = dragState.isHoveringReturnSlot ? activeKey : null;
    dragState.activeDocKey = null;
    dragState.isHoveringReturnSlot = false;

    if (deskElement) {
      this.evaluateZones(dragState, deskElement.getBoundingClientRect());
    }

    if (event && event.currentTarget && event.currentTarget.releasePointerCapture) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (err) {}
    }
    return droppedInSlot;
  },

  buildDocumentInlineStyle(docState) {
    if (!docState || docState.returned) return 'display: none;';
    const scaleValue = docState.isDragging ? 1.02 : 1.0;
    return `left: ${docState.x}px; top: ${docState.y}px; z-index: ${docState.z}; transform: rotate(${docState.rotation}deg) scale(${scaleValue});`;
  }
};
