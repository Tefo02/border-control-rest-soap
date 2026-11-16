window.DeskDragManager = {
  createInitialState() {
    return {
      topZIndex: 30,
      activeDocKey: null,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      lastClientX: 0,
      isHoveringReturnSlot: false,
      isPassportInStampBay: false,
      documents: {
        rulebook: {
          x: 16,
          y: 66,
          z: 14,
          rotation: -1.8,
          isDragging: false,
          returned: false
        },
        passport: {
          x: 155,
          y: 56,
          z: 22,
          rotation: -2.4,
          isDragging: false,
          returned: false
        },
        manifest: {
          x: 400,
          y: 78,
          z: 20,
          rotation: 2.6,
          isDragging: false,
          returned: false
        },
        wantedPoster: {
          x: 455,
          y: 44,
          z: 24,
          rotation: 1.5,
          isDragging: false,
          returned: false
        }
      }
    };
  },

  randomNaturalAngle() {
    const raw = (Math.random() * 7.6 - 3.8);
    if (Math.abs(raw) < 0.7) {
      return raw >= 0 ? 1.2 : -1.2;
    }
    return Number(raw.toFixed(1));
  },

  resetTravelerDocuments(dragState) {
    dragState.activeDocKey = null;
    dragState.isHoveringReturnSlot = false;
    dragState.isPassportInStampBay = false;
    dragState.documents.passport = {
      x: 150 + Math.floor(Math.random() * 24),
      y: 52 + Math.floor(Math.random() * 14),
      z: dragState.topZIndex + 2,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      returned: false
    };
    dragState.documents.manifest = {
      x: 390 + Math.floor(Math.random() * 24),
      y: 70 + Math.floor(Math.random() * 16),
      z: dragState.topZIndex + 1,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      returned: false
    };
    dragState.topZIndex += 3;
  },

  registerSoapPrintout(dragState, slipId, deskWidth, slipCount) {
    dragState.topZIndex += 1;
    const baseRightX = deskWidth ? Math.max(300, Math.min(deskWidth - 650, 560)) : 540;
    const cascadeOffset = ((slipCount - 1) % 5) * 18;
    dragState.documents[slipId] = {
      x: baseRightX + cascadeOffset,
      y: 12 + ((slipCount - 1) % 4) * 14,
      z: dragState.topZIndex,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      returned: false
    };
  },

  spawnWantedPosterPosition(dragState, deskWidth) {
    dragState.topZIndex += 1;
    const targetX = deskWidth ? Math.max(280, Math.min(deskWidth - 660, 490)) : 470;
    dragState.documents.wantedPoster = {
      x: targetX,
      y: 14,
      z: dragState.topZIndex,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      returned: false
    };
  },

  movePassportIntoStampBay(dragState, deskElement) {
    const deskWidth = deskElement ? deskElement.getBoundingClientRect().width : 1100;
    const passportDoc = dragState.documents.passport;
    dragState.topZIndex += 1;
    passportDoc.z = dragState.topZIndex;
    passportDoc.x = Math.max(300, deskWidth - 340);
    passportDoc.y = 88;
    passportDoc.rotation = -0.8;
    dragState.isPassportInStampBay = true;
  },

  evaluateZones(dragState, deskRect) {
    const passportDoc = dragState.documents.passport;
    if (passportDoc && deskRect) {
      const bayLeftEdge = deskRect.width - 375;
      dragState.isPassportInStampBay = passportDoc.x >= bayLeftEdge && passportDoc.y >= 36;
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
    if (event.target && event.target.closest('button')) {
      return;
    }
    const targetDoc = dragState.documents[docKey];
    if (!targetDoc || !deskElement || targetDoc.returned) return;
    this.bringToFront(dragState, docKey);
    targetDoc.isDragging = true;
    targetDoc.rotation = this.randomNaturalAngle();
    dragState.activeDocKey = docKey;
    dragState.lastClientX = event.clientX;

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

    const deltaX = event.clientX - (dragState.lastClientX || event.clientX);
    dragState.lastClientX = event.clientX;
    const sway = Math.max(-5.5, Math.min(5.5, deltaX * 0.22));
    targetDoc.rotation = Number((targetDoc.rotation * 0.75 + sway * 0.25).toFixed(1));

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
      targetDoc.rotation = this.randomNaturalAngle();
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
    const scaleValue = docState.isDragging ? 1.03 : 1.0;
    return `left: ${docState.x}px; top: ${docState.y}px; z-index: ${docState.z}; transform: rotate(${docState.rotation}deg) scale(${scaleValue});`;
  }
};
