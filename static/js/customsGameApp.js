window.customsGameApp = function () {
  return {
    shiftState: null,
    passenger: null,
    areDocumentsHandedOver: false,
    chatMessages: [],
    interrogationCycleIndex: 0,
    activeInterrogationTopic: null,
    rulebookPage: 0,
    mainframeData: null,
    isPrintingSoapSlip: false,
    printedSoapSlips: [],
    isPrintingWantedPoster: false,
    printedWantedPoster: null,
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
        if (event.code === 'Space' && this.passenger && !this.areDocumentsHandedOver) {
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
          if (event.key === 'Escape') this.showCitationPicker = false;
          return;
        }
      });
    },

    async startNewShiftDay() {
      this.printedSoapSlips = [];
      this.printedWantedPoster = null;
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

    appendChatMessage(sender, text) {
      this.chatMessages.push({
        id: Date.now() + Math.random(),
        sender,
        text
      });
      this.$nextTick(() => {
        const box = this.$refs.chatScrollBox;
        if (box) {
          box.scrollTop = box.scrollHeight;
        }
      });
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
      if (!this.passenger || this.areDocumentsHandedOver) return;
      this.areDocumentsHandedOver = true;
      this.appendChatMessage('OFFICER', 'Papers, please. Place your passport and customs manifest in the slot.');
      this.appendChatMessage('TRAVELER', this.passenger.dialogue_speech);
      window.DeskDragManager.resetTravelerDocuments(this.dragState);
      window.ProceduralAudioEngine.playSlotSlide();
    },

    askTraveler(topicKey) {
      if (!this.passenger || !this.passenger.interrogation_responses) return;
      if (!this.areDocumentsHandedOver) {
        this.requestDocumentsFromTraveler();
      }
      const officerPrompts = {
        origin: 'State your city of origin and embassy phone prefix.',
        currency: 'Confirm the currency declared on your customs manifest.',
        purpose: 'What is the exact purpose and duration of your stay?'
      };
      const answer = this.passenger.interrogation_responses[topicKey];
      if (!answer) return;
      this.activeInterrogationTopic = topicKey;
      this.appendChatMessage('OFFICER', officerPrompts[topicKey] || 'Clarify your statement.');
      this.appendChatMessage('TRAVELER', answer);
      window.ProceduralAudioEngine.playKeyClick();
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
      else if (activeKey === 'wantedPoster') docEl = this.$refs.wantedPosterDoc;
      else docEl = document.getElementById(activeKey);
      window.DeskDragManager.updateDrag(event, this.dragState, deskEl, docEl);
    },

    stopDocDrag(event) {
      const deskEl = this.$refs.deskSurface;
      const droppedDocKey = window.DeskDragManager.endDrag(event, this.dragState, deskEl);
      if (droppedDocKey === 'passport' || droppedDocKey === 'manifest') {
        this.handleDocumentDroppedInBoothSlot(droppedDocKey);
      }
    },

    handleDocumentDroppedInBoothSlot(docKey) {
      if (!this.verdictStamp) {
        this.appendChatMessage('TRAVELER', 'Officer, you have not stamped my passport yet! Use the stamp bay on the right first.');
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
        this.appendChatMessage('TRAVELER', `Thank you. Please slide my ${remainingName} through the slot as well.`);
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

      try {
        const res = await fetch('/api/inspections/next');
        this.passenger = await res.json();
        if (this.shiftState) {
          this.shiftState.current_passenger_index = this.passenger.passenger_index;
          this.shiftState.total_passengers = this.passenger.total_passengers;
        }
        this.appendChatMessage('TRAVELER', 'Good day, officer. Ready for inspection.');
        this.recordRestTelemetry(this.passenger.rest_telemetry);
        this.terminalLogs.push({
          id: Date.now(),
          text: `VISITOR #${this.passenger.passenger_index}/${this.passenger.total_passengers}: ${this.passenger.passenger_name.toUpperCase()}`,
          isError: false
        });
        window.ProceduralAudioEngine.playKeyClick();
        this.$nextTick(() => {
          if (window.hljs && this.isDevDrawerOpen) window.hljs.highlightAll();
        });
      } catch (err) {}
    },

    async executeManualSoapQuery() {
      const raw = this.manualCommand.trim().toUpperCase();
      if (!raw || this.isQuerying || !this.passenger) return;
      const cleanIso = raw.replace('QUERY', '').replace('ISO', '').trim();
      this.isQuerying = true;
      window.ProceduralAudioEngine.playModemHandshake();
      this.terminalLogs.push({ id: Date.now(), text: `> QUERY ${cleanIso}`, isError: false });
      this.terminalLogs.push({ id: Date.now() + 1, text: `DISPATCHING SOAP 1.1 ENVELOPE...`, isError: false });

      try {
        const res = await fetch(`/api/inspections/${this.passenger.inspection_id}/mainframe-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query_iso_code: cleanIso })
        });
        this.mainframeData = await res.json();
        this.recordSoapTelemetry(this.mainframeData.soap_telemetry);
        const rec = this.mainframeData.canonical_record;

        this.isPrintingSoapSlip = true;
        window.ProceduralAudioEngine.playDotMatrixPrinter();
        this.terminalLogs.push({
          id: Date.now() + 2,
          text: `XML (${this.mainframeData.soap_telemetry.bytes_received}B) -> PRINTING SLIP TO DESK...`,
          isError: false
        });

        const slipId = 'soapSlip_' + Date.now();
        const deskWidth = this.$refs.deskSurface ? this.$refs.deskSurface.getBoundingClientRect().width : 1100;
        const nextCount = this.printedSoapSlips.length + 1;
        window.DeskDragManager.registerSoapPrintout(this.dragState, slipId, deskWidth, nextCount);

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

        setTimeout(() => {
          this.isPrintingSoapSlip = false;
        }, 1750);

        this.manualCommand = '';
        this.$nextTick(() => {
          if (window.hljs && this.isDevDrawerOpen) window.hljs.highlightAll();
        });
      } catch (err) {
        this.terminalLogs.push({ id: Date.now() + 3, text: `NETWORK FAULT TALKING TO WSDL GATEWAY`, isError: true });
      } finally {
        this.isQuerying = false;
      }
    },

    async printDailyWantedPoster() {
      if (this.isPrintingWantedPoster) return;
      this.isPrintingWantedPoster = true;
      window.ProceduralAudioEngine.playDotMatrixPrinter();

      try {
        const res = await fetch('/api/inspections/shift/current');
        this.shiftState = await res.json();
        const deskWidth = this.$refs.deskSurface ? this.$refs.deskSurface.getBoundingClientRect().width : 1100;
        window.DeskDragManager.spawnWantedPosterPosition(this.dragState, deskWidth);
        this.printedWantedPoster = {
          dayNumber: this.shiftState.day_number,
          criminals: this.shiftState.wanted_list
        };
      } catch (err) {
      } finally {
        setTimeout(() => {
          this.isPrintingWantedPoster = false;
        }, 1200);
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
      this.appendChatMessage('SYSTEM', 'Passport stamped ADMITTED. Drag Passport and Manifest up to the top slot to return them.');
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
      this.appendChatMessage('SYSTEM', `Passport stamped DETAINED (${categoryCode}). Drag Passport and Manifest up to the top slot to return them.`);
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
        this.appendChatMessage('TRAVELER', result.traveler_reaction);
        this.verdictReport = result;

        if (!result.is_correct) {
          window.ProceduralAudioEngine.playAlertBuzzer();
        } else {
          window.ProceduralAudioEngine.playKeyClick();
        }
      } catch (err) {
      } finally {
        this.isSubmitting = false;
      }
    },

    advanceAfterVerdict() {
      if (this.verdictReport && this.verdictReport.is_shift_completed) {
        this.startNewShiftDay();
      } else {
        this.verdictReport = null;
        this.loadNextTraveler();
      }
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
