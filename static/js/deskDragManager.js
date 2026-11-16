window.DeskDragManager = {
  createInitialState() {
    return {
      topZIndex: 30,
      activeDocKey: null,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      lastClientX: 0,
      isHoveringReturnSlot: false,
      isHoveringTrashBin: false,
      isPassportInStampBay: false,
      documents: {
        rulebook: {
          x: 135,
          y: 78,
          z: 14,
          rotation: -2.2,
          isDragging: false,
          returned: false
        },
        passport: {
          x: 240,
          y: 62,
          z: 22,
          rotation: -2.6,
          isDragging: false,
          returned: false
        },
        manifest: {
          x: 450,
          y: 84,
          z: 20,
          rotation: 2.8,
          isDragging: false,
          returned: false
        }
      }
    };
  },

  randomNaturalAngle() {
    const raw = (Math.random() * 8.4 - 4.2);
    if (Math.abs(raw) < 1.1) {
      return raw >= 0 ? 1.6 : -1.6;
    }
    return Number(raw.toFixed(1));
  },

  animatePaperFeedFromPrinter(dragState, docKey, finalY) {
    const doc = dragState.documents[docKey];
    if (!doc) return;
    const startY = -95;
    const totalSteps = 9;
    const stepDelta = (finalY - startY) / totalSteps;
    doc.y = startY;

    for (let step = 1; step <= totalSteps; step++) {
      setTimeout(() => {
        if (dragState.documents[docKey] && !dragState.documents[docKey].isDragging) {
          dragState.documents[docKey].y = Math.round(startY + stepDelta * step);
        }
      }, step * 145);
    }
  },

  resetTravelerDocuments(dragState) {
    dragState.activeDocKey = null;
    dragState.isHoveringReturnSlot = false;
    dragState.isHoveringTrashBin = false;
    dragState.isPassportInStampBay = false;
    dragState.documents.passport = {
      x: 210 + Math.floor(Math.random() * 24),
      y: 54 + Math.floor(Math.random() * 14),
      z: dragState.topZIndex + 2,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      returned: false
    };
    dragState.documents.manifest = {
      x: 445 + Math.floor(Math.random() * 24),
      y: 72 + Math.floor(Math.random() * 16),
      z: dragState.topZIndex + 1,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      returned: false
    };
    dragState.topZIndex += 3;
  },

  registerSoapPrintout(dragState, slipId, deskWidth, slipCount) {
    dragState.topZIndex += 1;
    const baseRightX = deskWidth ? Math.max(320, Math.min(deskWidth - 650, 560)) : 540;
    const cascadeOffset = ((slipCount - 1) % 5) * 18;
    const targetY = 34 + ((slipCount - 1) % 4) * 16;
    dragState.documents[slipId] = {
      x: baseRightX + cascadeOffset,
      y: -95,
      z: dragState.topZIndex,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      returned: false
    };
    this.animatePaperFeedFromPrinter(dragState, slipId, targetY);
  },

  registerWantedPoster(dragState, posterId, deskWidth, posterCount) {
    dragState.topZIndex += 1;
    const targetX = deskWidth ? Math.max(290, Math.min(deskWidth - 660, 480)) : 460;
    const cascadeOffset = ((posterCount - 1) % 4) * 16;
    const targetY = 28 + ((posterCount - 1) % 3) * 14;
    dragState.documents[posterId] = {
      x: targetX + cascadeOffset,
      y: -95,
      z: dragState.topZIndex,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      returned: false
    };
    this.animatePaperFeedFromPrinter(dragState, posterId, targetY);
  },

  bounceBackToDesk(dragState, docKey) {
    const doc = dragState.documents[docKey];
    if (!doc) return;
    doc.x = 180 + Math.floor(Math.random() * 40);
    doc.y = 75 + Math.floor(Math.random() * 30);
    doc.rotation = this.randomNaturalAngle();
  },

  movePassportIntoStampBay(dragState, deskElement) {
    const deskWidth = deskElement ? deskElement.getBoundingClientRect().width : 1100;
    const passportDoc = dragState.documents.passport;
    dragState.topZIndex += 1;
    passportDoc.z = dragState.topZIndex;
    passportDoc.x = Math.max(300, deskWidth - 340);
    passportDoc.y = 78;
    passportDoc.rotation = -1.2;
    dragState.isPassportInStampBay = true;
  },

  evaluateZones(dragState, deskRect) {
    const passportDoc = dragState.documents.passport;
    if (passportDoc && deskRect) {
      const bayLeftEdge = deskRect.width - 375;
      dragState.isPassportInStampBay = passportDoc.x >= bayLeftEdge && passportDoc.y >= 24;
    }
    const activeKey = dragState.activeDocKey;
    if (!activeKey) {
      dragState.isHoveringReturnSlot = false;
      dragState.isHoveringTrashBin = false;
      return;
    }
    const activeDoc = dragState.documents[activeKey];
    if (!activeDoc) return;

    if (activeKey === 'passport' || activeKey === 'manifest') {
      dragState.isHoveringReturnSlot = activeDoc.y < -42 && activeDoc.x <= 540;
    } else {
      dragState.isHoveringReturnSlot = false;
    }

    const deskHeight = deskRect ? deskRect.height : 480;
    dragState.isHoveringTrashBin = activeDoc.x < 105 && activeDoc.y > (deskHeight - 175);
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

    const minX = -35;
    const maxX = Math.max(8, deskRect.width - docWidth - 8);
    const minY = (activeKey === 'passport' || activeKey === 'manifest') ? -240 : -30;
    const maxY = Math.max(20, deskRect.height - docHeight + 35);

    const deltaX = event.clientX - (dragState.lastClientX || event.clientX);
    dragState.lastClientX = event.clientX;
    const sway = Math.max(-6.5, Math.min(6.5, deltaX * 0.25));
    targetDoc.rotation = Number((targetDoc.rotation * 0.72 + sway * 0.28).toFixed(1));

    targetDoc.x = Math.min(Math.max(minX, rawX), maxX);
    targetDoc.y = Math.min(Math.max(minY, rawY), maxY);

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

    let dropOutcome = null;
    if (dragState.isHoveringTrashBin) {
      dropOutcome = { action: 'TRASH', docKey: activeKey };
    } else if (dragState.isHoveringReturnSlot) {
      dropOutcome = { action: 'RETURN_PASSENGER', docKey: activeKey };
    } else if (targetDoc && targetDoc.y < 10) {
      targetDoc.y = 18;
    }

    dragState.activeDocKey = null;
    dragState.isHoveringReturnSlot = false;
    dragState.isHoveringTrashBin = false;

    if (deskElement) {
      this.evaluateZones(dragState, deskElement.getBoundingClientRect());
    }

    if (event && event.currentTarget && event.currentTarget.releasePointerCapture) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (err) {}
    }
    return dropOutcome;
  },

  buildDocumentInlineStyle(docState) {
    if (!docState || docState.returned) return 'display: none;';
    const scaleValue = docState.isDragging ? 1.03 : 1.0;
    return `left: ${docState.x}px; top: ${docState.y}px; z-index: ${docState.z}; transform: rotate(${docState.rotation}deg) scale(${scaleValue});`;
  }
};
