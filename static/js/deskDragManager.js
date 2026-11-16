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
          x: 24,
          y: 68,
          z: 14,
          rotation: -2.2,
          isDragging: false,
          isFeeding: false,
          feedHeight: null,
          returned: false
        },
        passport: {
          x: 215,
          y: 58,
          z: 22,
          rotation: -2.6,
          isDragging: false,
          isFeeding: false,
          feedHeight: null,
          returned: false
        },
        manifest: {
          x: 435,
          y: 80,
          z: 20,
          rotation: 2.8,
          isDragging: false,
          isFeeding: false,
          feedHeight: null,
          returned: false
        }
      }
    };
  },

  randomNaturalAngle() {
    const raw = (Math.random() * 8.4 - 4.2);
    if (Math.abs(raw) < 1.3) {
      return raw >= 0 ? 1.8 : -1.8;
    }
    return Number(raw.toFixed(1));
  },

  animateProgressivePaperFeed(dragState, docKey, targetY, totalHeight, stepsCount, onComplete) {
    const doc = dragState.documents[docKey];
    if (!doc) return;
    doc.isFeeding = true;
    doc.rotation = 0;
    doc.y = 0;
    doc.feedHeight = 24;

    const heightPerStep = Math.ceil((totalHeight - 24) / stepsCount);

    for (let step = 1; step <= stepsCount; step++) {
      setTimeout(() => {
        const currentDoc = dragState.documents[docKey];
        if (!currentDoc) return;
        if (window.ProceduralAudioEngine) {
          window.ProceduralAudioEngine.playSinglePrintLineBuzz();
        }
        if (step < stepsCount) {
          currentDoc.feedHeight = Math.min(totalHeight, 24 + heightPerStep * step);
        } else {
          currentDoc.isFeeding = false;
          currentDoc.feedHeight = null;
          currentDoc.y = targetY;
          currentDoc.rotation = this.randomNaturalAngle();
          if (window.ProceduralAudioEngine) {
            window.ProceduralAudioEngine.playPaperRustle();
          }
          if (typeof onComplete === 'function') {
            onComplete();
          }
        }
      }, step * 230);
    }
  },

  resetTravelerDocuments(dragState) {
    dragState.activeDocKey = null;
    dragState.isHoveringReturnSlot = false;
    dragState.isHoveringTrashBin = false;
    dragState.isPassportInStampBay = false;
    dragState.documents.passport = {
      x: 195 + Math.floor(Math.random() * 24),
      y: 52 + Math.floor(Math.random() * 14),
      z: dragState.topZIndex + 2,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      isFeeding: false,
      feedHeight: null,
      returned: false
    };
    dragState.documents.manifest = {
      x: 425 + Math.floor(Math.random() * 24),
      y: 70 + Math.floor(Math.random() * 16),
      z: dragState.topZIndex + 1,
      rotation: this.randomNaturalAngle(),
      isDragging: false,
      isFeeding: false,
      feedHeight: null,
      returned: false
    };
    dragState.topZIndex += 3;
  },

  registerSoapPrintout(dragState, slipId, deskWidth, slipCount, onFinishCallback) {
    dragState.topZIndex += 1;
    const baseRightX = deskWidth ? Math.max(300, Math.min(deskWidth - 640, 540)) : 510;
    const cascadeOffset = ((slipCount - 1) % 5) * 18;
    const targetY = 30 + ((slipCount - 1) % 4) * 16;
    dragState.documents[slipId] = {
      x: baseRightX + cascadeOffset,
      y: 0,
      z: dragState.topZIndex,
      rotation: 0,
      isDragging: false,
      isFeeding: true,
      feedHeight: 24,
      returned: false
    };
    this.animateProgressivePaperFeed(dragState, slipId, targetY, 155, 7, onFinishCallback);
  },

  registerWantedPoster(dragState, posterId, deskWidth, posterCount, onFinishCallback) {
    dragState.topZIndex += 1;
    const targetX = deskWidth ? Math.max(270, Math.min(deskWidth - 650, 450)) : 430;
    const cascadeOffset = ((posterCount - 1) % 4) * 16;
    const targetY = 26 + ((posterCount - 1) % 3) * 14;
    dragState.documents[posterId] = {
      x: targetX + cascadeOffset,
      y: 0,
      z: dragState.topZIndex,
      rotation: 0,
      isDragging: false,
      isFeeding: true,
      feedHeight: 24,
      returned: false
    };
    this.animateProgressivePaperFeed(dragState, posterId, targetY, 345, 9, onFinishCallback);
  },

  bounceBackToDesk(dragState, docKey) {
    const doc = dragState.documents[docKey];
    if (!doc) return;
    doc.x = 180 + Math.floor(Math.random() * 40);
    doc.y = 75 + Math.floor(Math.random() * 30);
    doc.rotation = this.randomNaturalAngle();
  },

  movePassportIntoStampBay(dragState, deskElement) {
    const deskWidth = deskElement ? deskElement.getBoundingClientRect().width : 1000;
    const passportDoc = dragState.documents.passport;
    dragState.topZIndex += 1;
    passportDoc.z = dragState.topZIndex;
    passportDoc.x = Math.max(280, deskWidth - 335);
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
      dragState.isHoveringReturnSlot = activeDoc.y < -45 && activeDoc.x <= 520;
    } else {
      dragState.isHoveringReturnSlot = false;
    }

    dragState.isHoveringTrashBin = activeDoc.x < -30;
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
    if (!targetDoc || !deskElement || targetDoc.returned || targetDoc.isFeeding) return;
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

    const minX = -145;
    const maxX = Math.max(8, deskRect.width - docWidth - 8);
    const minY = (activeKey === 'passport' || activeKey === 'manifest') ? -240 : 4;
    const maxY = Math.max(20, deskRect.height - docHeight + 25);

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
    } else if (targetDoc) {
      if (targetDoc.y < 10) targetDoc.y = 18;
      if (targetDoc.x < 8) targetDoc.x = 18;
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
    const rot = docState.isFeeding ? 0 : docState.rotation;
    const clipStyle = docState.isFeeding && docState.feedHeight
      ? `max-height: ${docState.feedHeight}px; overflow: hidden;`
      : '';
    return `left: ${docState.x}px; top: ${docState.y}px; z-index: ${docState.z}; transform: rotate(${rot}deg) scale(${scaleValue}); ${clipStyle}`;
  }
};
