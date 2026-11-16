window.customsGameApp = function () {
  return {
    shiftState: null,
    passenger: null,
    travelerAnimationState: 'empty',
    isTravelerTyping: false,
    areDocumentsHandedOver: false,
    chatMessages: [],
    interrogationCycleIndex: 0,
    activeInterrogationTopic: null,
    rulebookPage: 0,
    mainframeData: null,
    isPrintingSoapSlip: false,
    printedSoapSlips: [],
    isPrintingWantedPoster: false,
    printedWantedPosters: [],
    faultSimulationData: null,
    activeWindow: 'mainframe',
    activeTelemetryTab: 'metrics',
    isDevDrawerOpen: false,
    showCitationPicker: false,
    selectedViolationCategory: null,
    manualCommand: '',
    dragState: window.DeskDragManager.createInitialState(),
    terminalLogs: [
      { id: 1, text: 'IBM OS/390 CICS ONLINE. TYPE ISO CODE TO PRINT WSDL RECORD.', isError: false }
    ],
    score: 0,
    inspectionsCount: 0,
    correctCount: 0,
    accuracyRate: 100,
    sessionStats: {
      restCalls: 0,
      soapCalls: 0,
      totalRestLatency: 0,
      totalSoapLatency: 0,
      totalRestBytes: 0,
      totalSoapBytes: 0
    },
    isQuerying: false,
    isSubmitting: false,
    verdictStamp: null,
    verdictReport: null,

    async initWorkstation() {
      window.ProceduralAudioEngine.ensureContext();
      this.registerKeyboardShortcuts();
      await this.startNewShiftDay();
    },

    registerKeyboardShortcuts() {
      window.addEventListener('keydown', (event) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
          return;
        }
        if (event.code === 'Space' && this.passenger && !this.areDocumentsHandedOver && !this.isTravelerTyping) {
          event.preventDefault();
          this.requestDocumentsFromTraveler();
          return;
        }
        if (this.verdictReport && event.key === 'Enter') {
          event.preventDefault();
          this.advanceAfterVerdict();
          return;
        }
        if (this.showCitationPicker) {
          if (event.key === '1') this.confirmDenialWithCategory('WSDL_MISMATCH');
          if (event.key === '2') this.confirmDenialWithCategory('EXPIRED_PASSPORT');
          if (event.key === '3') this.confirmDenialWithCategory('VERBAL_CONTRADICTION');
          if (event.key === '4') this.confirmDenialWithCategory('INTERPOL_WANTED');
          if (event.key === '5') this.confirmDenialWithCategory('BIOMETRIC_MISMATCH');
          if (event.key === 'Escape') this.showCitationPicker = false;
          return;
        }
      });
    },

    async startNewShiftDay() {
      this.printedSoapSlips = [];
      this.printedWantedPosters = [];
      this.verdictReport = null;
      try {
        const res = await fetch('/api/inspections/shift/start', { method: 'POST' });
        this.shiftState = await res.json();
        this.recordRestTelemetry(this.shiftState.rest_telemetry);
        this.terminalLogs.push({
          id: Date.now(),
          text: `DAY ${this.shiftState.day_number} SHIFT INITIALIZED (${this.shiftState.total_passengers} PASSENGERS IN QUEUE).`,
          isError: false
        });
        await this.loadNextTraveler();
      } catch (err) {}
    },

    openRulebook() {
      this.rulebookPage = 1;
      window.ProceduralAudioEngine.playPaperRustle();
    },

    nextRulebookPage() {
      if (this.rulebookPage < 3) {
        this.rulebookPage += 1;
        window.ProceduralAudioEngine.playPaperRustle();
      }
    },

    prevRulebookPage() {
      if (this.rulebookPage > 1) {
        this.rulebookPage -= 1;
        window.ProceduralAudioEngine.playPaperRustle();
      } else {
        this.rulebookPage = 0;
        window.ProceduralAudioEngine.playPaperRustle();
      }
    },

    closeRulebookCover() {
      this.rulebookPage = 0;
      window.ProceduralAudioEngine.playPaperRustle();
    },

    scrollChatToBottom() {
      this.$nextTick(() => {
        const box = this.$refs.chatScrollBox;
        if (box) {
          box.scrollTop = box.scrollHeight;
        }
      });
    },

    pushTerminalLog(text, isError = false) {
      this.terminalLogs.push({
        id: Date.now() + Math.random(),
        text,
        isError
      });
      this.$nextTick(() => {
        const logBox = this.$refs.terminalLogBox;
        if (logBox) {
          logBox.scrollTop = logBox.scrollHeight;
        }
      });
    },

    appendChatMessage(sender, text) {
      this.chatMessages.push({
        id: Date.now() + Math.random(),
        sender,
        text
      });
      this.scrollChatToBottom();
    },

    enqueueTravelerReplyWithDelay(text, delayMs = 850, onDelivered = null) {
      this.isTravelerTyping = true;
      this.scrollChatToBottom();
      setTimeout(() => {
        this.isTravelerTyping = false;
        this.appendChatMessage('TRAVELER', text);
        window.ProceduralAudioEngine.playKeyClick();
        if (typeof onDelivered === 'function') {
          onDelivered();
        }
      }, delayMs);
    },

    toggleDevDrawer() {
      this.isDevDrawerOpen = !this.isDevDrawerOpen;
      window.ProceduralAudioEngine.playKeyClick();
      if (this.isDevDrawerOpen) {
        this.$nextTick(() => {
          if (window.hljs) window.hljs.highlightAll();
        });
      }
    },

    requestDocumentsFromTraveler() {
      if (!this.passenger || this.areDocumentsHandedOver || this.isTravelerTyping) return;
      this.appendChatMessage('OFFICER', 'Papers, please. Place your passport and customs manifest in the slot.');
      window.ProceduralAudioEngine.playKeyClick();

      this.enqueueTravelerReplyWithDelay(this.passenger.dialogue_speech, 900, () => {
        this.areDocumentsHandedOver = true;
        window.DeskDragManager.resetTravelerDocuments(this.dragState);
        window.ProceduralAudioEngine.playSlotSlide();
      });
    },

    askTraveler(topicKey) {
      if (!this.passenger || !this.passenger.interrogation_responses || this.isTravelerTyping) return;
      const officerPrompts = {
        origin: 'State your city of origin and embassy phone prefix.',
        currency: 'Confirm the currency declared on your customs manifest.',
        purpose: 'What is the exact purpose and duration of your stay?'
      };
      const answer = this.passenger.interrogation_responses[topicKey];
      if (!answer) return;
      this.activeInterrogationTopic = topicKey;
      this.appendChatMessage('OFFICER', officerPrompts[topicKey] || 'Clarify your statement.');
      window.ProceduralAudioEngine.playKeyClick();

      this.enqueueTravelerReplyWithDelay(answer, 950);
    },

    startDocDrag(event, docKey) {
      const deskEl = this.$refs.deskSurface;
      window.DeskDragManager.beginDrag(event, this.dragState, docKey, deskEl);
    },

    moveDocDrag(event) {
      if (!this.dragState.activeDocKey) return;
      const deskEl = this.$refs.deskSurface;
      const activeKey = this.dragState.activeDocKey;
      let docEl = null;
      if (activeKey === 'passport') docEl = this.$refs.passportDoc;
      else if (activeKey === 'manifest') docEl = this.$refs.manifestDoc;
      else if (activeKey === 'rulebook') docEl = this.$refs.rulebookDoc;
      else docEl = document.getElementById(activeKey);
      window.DeskDragManager.updateDrag(event, this.dragState, deskEl, docEl);
    },

    stopDocDrag(event) {
      const deskEl = this.$refs.deskSurface;
      const outcome = window.DeskDragManager.endDrag(event, this.dragState, deskEl);
      if (!outcome) return;
      if (outcome.action === 'TRASH') {
        this.handleDocumentTrashDrop(outcome.docKey);
      } else if (outcome.action === 'RETURN_PASSENGER') {
        this.handleDocumentDroppedInBoothSlot(outcome.docKey);
      }
    },

    handleDocumentTrashDrop(docKey) {
      if (docKey.startsWith('soapSlip_')) {
        this.printedSoapSlips = this.printedSoapSlips.filter((s) => s.id !== docKey);
        delete this.dragState.documents[docKey];
        window.ProceduralAudioEngine.playPaperCrumple();
        return;
      }
      if (docKey.startsWith('wantedPoster_')) {
        this.printedWantedPosters = this.printedWantedPosters.filter((p) => p.id !== docKey);
        delete this.dragState.documents[docKey];
        window.ProceduralAudioEngine.playPaperCrumple();
        return;
      }
      window.DeskDragManager.bounceBackToDesk(this.dragState, docKey);
      window.ProceduralAudioEngine.playAlertBuzzer();
      this.appendChatMessage('SYSTEM', 'Protected document! Only printed slips (WSDL & Wanted lists) can be thrown into the external trash bin.');
    },

    handleDocumentDroppedInBoothSlot(docKey) {
      if (!this.verdictStamp) {
        window.DeskDragManager.bounceBackToDesk(this.dragState, docKey);
        this.enqueueTravelerReplyWithDelay('Officer, you have not stamped my passport yet! Use the stamp bay on the right first.', 650);
        window.ProceduralAudioEngine.playAlertBuzzer();
        return;
      }
      this.dragState.documents[docKey].returned = true;
      window.ProceduralAudioEngine.playSlotSlide();

      const pReturned = this.dragState.documents.passport.returned;
      const mReturned = this.dragState.documents.manifest.returned;

      if (pReturned && mReturned) {
        this.finalizeRoundVerdict();
      } else {
        const remainingName = pReturned ? 'Customs Manifest' : 'Stamped Passport';
        this.enqueueTravelerReplyWithDelay(`Thank you. Please drag my ${remainingName} up here to the window as well.`, 600);
      }
    },

    getDocStyle(docKey) {
      return window.DeskDragManager.buildDocumentInlineStyle(this.dragState.documents[docKey]);
    },

    isDocDragging(docKey) {
      return this.dragState.documents[docKey] ? this.dragState.documents[docKey].isDragging : false;
    },

    mrzLines() {
      return window.MrzAndBarcodeGenerator.generatePassportMrzLines(this.passenger);
    },

    barcodeBars() {
      const seed = this.passenger ? this.passenger.inspection_id : 'DEFAULT';
      return window.MrzAndBarcodeGenerator.generateBarcodeRectangles(seed);
    },

    recordRestTelemetry(telemetry) {
      if (!telemetry) return;
      this.sessionStats.restCalls += 1;
      this.sessionStats.totalRestLatency += telemetry.latency_ms || 0;
      this.sessionStats.totalRestBytes += telemetry.bytes_received || 0;
    },

    recordSoapTelemetry(telemetry) {
      if (!telemetry) return;
      this.sessionStats.soapCalls += 1;
      this.sessionStats.totalSoapLatency += telemetry.latency_ms || 0;
      this.sessionStats.totalSoapBytes += telemetry.bytes_received || 0;
    },

    averageRestLatency() {
      if (!this.sessionStats.restCalls) return '0.0';
      return (this.sessionStats.totalRestLatency / this.sessionStats.restCalls).toFixed(1);
    },

    averageSoapLatency() {
      if (!this.sessionStats.soapCalls) return '0.0';
      return (this.sessionStats.totalSoapLatency / this.sessionStats.soapCalls).toFixed(1);
    },

    async loadNextTraveler() {
      this.verdictStamp = null;
      this.verdictReport = null;
      this.showCitationPicker = false;
      this.selectedViolationCategory = null;
      this.areDocumentsHandedOver = false;
      this.activeInterrogationTopic = null;
      this.interrogationCycleIndex = 0;
      this.mainframeData = null;
      this.manualCommand = '';
      this.chatMessages = [];
      this.travelerAnimationState = 'empty';

      try {
        const res = await fetch('/api/inspections/next');
        const nextPassenger = await res.json();

        setTimeout(() => {
          this.passenger = nextPassenger;
          this.travelerAnimationState = 'walking-in';
          window.ProceduralAudioEngine.playFootsteps();

          if (this.shiftState) {
            this.shiftState.current_passenger_index = this.passenger.passenger_index;
            this.shiftState.total_passengers = this.passenger.total_passengers;
          }
          this.recordRestTelemetry(this.passenger.rest_telemetry);
          this.pushTerminalLog(
            `VISITOR #${this.passenger.passenger_index}/${this.passenger.total_passengers}: ${this.passenger.passenger_name.toUpperCase()}`,
            false
          );

          setTimeout(() => {
            this.travelerAnimationState = 'idle';
            this.enqueueTravelerReplyWithDelay('Good day, officer. Ready for inspection.', 850);
          }, 600);

          this.$nextTick(() => {
            if (window.hljs && this.isDevDrawerOpen) window.hljs.highlightAll();
          });
        }, 420);
      } catch (err) {}
    },

    async executeManualSoapQuery() {
      const raw = this.manualCommand.trim().toUpperCase();
      if (!raw || this.isQuerying || this.isPrintingSoapSlip || !this.passenger) return;
      const cleanIso = raw.replace('QUERY', '').replace('ISO', '').trim();
      this.isQuerying = true;
      this.manualCommand = '';
      window.ProceduralAudioEngine.playModemHandshake();
      this.pushTerminalLog(`> QUERY ${cleanIso}`, false);
      this.pushTerminalLog(`DIALING OORSPRONG GATEWAY [9600 BAUD]...`, false);

      try {
        const res = await fetch(`/api/inspections/${this.passenger.inspection_id}/mainframe-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query_iso_code: cleanIso })
        });
        const queryData = await res.json();

        setTimeout(() => {
          this.pushTerminalLog(
            `PARSING SOAP 1.1 ENVELOPE (${queryData.soap_telemetry.bytes_received} BYTES)...`,
            false
          );
          window.ProceduralAudioEngine.playKeyClick();
        }, 850);

        setTimeout(() => {
          this.mainframeData = queryData;
          this.recordSoapTelemetry(this.mainframeData.soap_telemetry);
          const rec = this.mainframeData.canonical_record;

          this.isQuerying = false;
          this.isPrintingSoapSlip = true;
          this.pushTerminalLog(`WSDL VERIFIED -> FEEDING TRACTOR PAPER ON LPT1...`, false);

          const slipId = 'soapSlip_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          const deskWidth = this.$refs.deskSurface ? this.$refs.deskSurface.getBoundingClientRect().width : 1000;
          const nextCount = this.printedSoapSlips.length + 1;

          window.DeskDragManager.registerSoapPrintout(this.dragState, slipId, deskWidth, nextCount, () => {
            this.isPrintingSoapSlip = false;
          });

          const newSlip = (rec && rec.name !== 'Unknown')
            ? {
                id: slipId,
                queriedIso: cleanIso,
                isFault: false,
                name: rec.name,
                capital: rec.capital,
                currency: rec.currency_code,
                phone: '+' + rec.phone_code
              }
            : {
                id: slipId,
                queriedIso: cleanIso,
                isFault: true,
                faultMessage: `SOAP FAULT: ISO '${cleanIso}' INVALID`
              };

          this.printedSoapSlips.push(newSlip);
          this.$nextTick(() => {
            if (window.hljs && this.isDevDrawerOpen) window.hljs.highlightAll();
          });
        }, 1650);
      } catch (err) {
        this.isQuerying = false;
        this.terminalLogs.push({ id: Date.now() + 4, text: `NETWORK FAULT TALKING TO WSDL GATEWAY`, isError: true });
      }
    },

    async printDailyWantedPoster() {
      if (this.isPrintingWantedPoster) return;
      this.isPrintingWantedPoster = true;
      window.ProceduralAudioEngine.playModemHandshake();

      try {
        const res = await fetch('/api/inspections/shift/current');
        this.shiftState = await res.json();

        setTimeout(() => {
          const posterId = 'wantedPoster_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          const deskWidth = this.$refs.deskSurface ? this.$refs.deskSurface.getBoundingClientRect().width : 1000;
          const nextCount = this.printedWantedPosters.length + 1;

          window.DeskDragManager.registerWantedPoster(this.dragState, posterId, deskWidth, nextCount, () => {
            this.isPrintingWantedPoster = false;
          });

          this.printedWantedPosters.push({
            id: posterId,
            dayNumber: this.shiftState.day_number,
            criminals: this.shiftState.wanted_list
          });
        }, 850);
      } catch (err) {
        this.isPrintingWantedPoster = false;
      }
    },

    async triggerFaultSimulation() {
      window.ProceduralAudioEngine.playModemHandshake();
      try {
        const res = await fetch('/api/inspections/debug/fault-simulation', { method: 'POST' });
        this.faultSimulationData = await res.json();
        this.activeTelemetryTab = 'fault_sim';
        this.$nextTick(() => {
          if (window.hljs) window.hljs.highlightAll();
        });
      } catch (err) {}
    },

    ensurePassportInStampBay() {
      if (!this.areDocumentsHandedOver) {
        this.requestDocumentsFromTraveler();
      }
      if (!this.dragState.isPassportInStampBay) {
        window.DeskDragManager.movePassportIntoStampBay(this.dragState, this.$refs.deskSurface);
      }
    },

    stampPassportApprove() {
      if (!this.passenger || this.isSubmitting) return;
      this.ensurePassportInStampBay();
      this.showCitationPicker = false;
      this.selectedViolationCategory = null;
      this.verdictStamp = 'APPROVE';
      window.ProceduralAudioEngine.playStampImpact();
      this.appendChatMessage('SYSTEM', 'Passport stamped ADMITTED. Drag Passport and Manifest UP into the Passenger Window to hand them back.');
    },

    openDenialCitationPicker() {
      if (!this.passenger || this.isSubmitting) return;
      this.ensurePassportInStampBay();
      this.showCitationPicker = true;
      window.ProceduralAudioEngine.playKeyClick();
    },

    confirmDenialWithCategory(categoryCode) {
      this.showCitationPicker = false;
      this.selectedViolationCategory = categoryCode;
      this.verdictStamp = 'DENY';
      window.ProceduralAudioEngine.playStampImpact();
      this.appendChatMessage('SYSTEM', `Passport stamped DETAINED (${categoryCode}). Drag Passport and Manifest UP into the Passenger Window to return them.`);
    },

    async finalizeRoundVerdict() {
      if (!this.passenger || this.isSubmitting || !this.verdictStamp) return;
      this.isSubmitting = true;

      try {
        const res = await fetch(`/api/inspections/${this.passenger.inspection_id}/verdict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: this.verdictStamp,
            violation_category: this.selectedViolationCategory
          })
        });
        const result = await res.json();
        this.score += result.score_delta;
        this.inspectionsCount++;
        if (result.is_correct) this.correctCount++;
        this.accuracyRate = Math.round((this.correctCount / this.inspectionsCount) * 100);

        this.enqueueTravelerReplyWithDelay(result.traveler_reaction, 700, () => {
          this.verdictReport = result;
          if (!result.is_correct) {
            window.ProceduralAudioEngine.playAlertBuzzer();
          } else {
            window.ProceduralAudioEngine.playKeyClick();
          }
        });
      } catch (err) {
      } finally {
        this.isSubmitting = false;
      }
    },

    advanceAfterVerdict() {
      const shiftDone = this.verdictReport && this.verdictReport.is_shift_completed;
      this.verdictReport = null;
      this.travelerAnimationState = 'walking-out';
      window.ProceduralAudioEngine.playFootsteps();

      setTimeout(() => {
        if (shiftDone) {
          this.startNewShiftDay();
        } else {
          this.loadNextTraveler();
        }
      }, 600);
    },

    calculateOverhead() {
      if (!this.passenger || !this.mainframeData) return 'Awaiting Both Calls';
      const restBytes = this.passenger.rest_telemetry.bytes_received;
      const soapBytes = this.mainframeData.soap_telemetry.bytes_received;
      if (!restBytes || !soapBytes) return '-';
      const diff = ((soapBytes - restBytes) / restBytes) * 100;
      return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% XML Overhead`;
    },

    formatJson(raw) {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch (e) {
        return raw;
      }
    }
  };
};
