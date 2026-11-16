window.customsGameApp = function () {
  return {
    passenger: null,
    areDocumentsHandedOver: false,
    currentSpeech: '',
    interrogationCycleIndex: 0,
    activeInterrogationTopic: null,
    mainframeData: null,
    isPrintingSoapSlip: false,
    printedSoapSlip: null,
    interpolData: null,
    printedInterpolSlip: null,
    faultSimulationData: null,
    activeWindow: 'mainframe',
    activeTelemetryTab: 'metrics',
    isDevDrawerOpen: false,
    showCitationPicker: false,
    selectedViolationCategory: null,
    stampStatusHint: 'DRAG PASSPORT HERE TO STAMP',
    manualCommand: '',
    dragState: window.DeskDragManager.createInitialState(),
    terminalLogs: [
      { id: 1, text: 'IBM OS/390 CICS ONLINE. TYPE ISO CODE TO QUERY WSDL.', isError: false }
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
    isInterpolQuerying: false,
    isSubmitting: false,
    verdictStamp: null,
    verdictReport: null,

    initWorkstation() {
      window.ProceduralAudioEngine.ensureContext();
      this.registerKeyboardShortcuts();
      this.loadNextTraveler();
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
          this.dismissModalAndNext();
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
      this.currentSpeech = this.passenger.dialogue_speech;
      window.DeskDragManager.resetTravelerDocuments(this.dragState);
      window.ProceduralAudioEngine.playSlotSlide();
    },

    cycleDialogueOnBubbleClick() {
      if (!this.passenger) return;
      if (!this.areDocumentsHandedOver) {
        this.requestDocumentsFromTraveler();
        return;
      }
      const topics = ['origin', 'currency', 'purpose'];
      const nextTopic = topics[this.interrogationCycleIndex % topics.length];
      this.interrogationCycleIndex += 1;
      this.askTraveler(nextTopic);
    },

    askTraveler(topicKey) {
      if (!this.passenger || !this.passenger.interrogation_responses) return;
      if (!this.areDocumentsHandedOver) {
        this.requestDocumentsFromTraveler();
      }
      const answer = this.passenger.interrogation_responses[topicKey];
      if (!answer) return;
      this.activeInterrogationTopic = topicKey;
      this.currentSpeech = answer;
      window.ProceduralAudioEngine.playKeyClick();
    },

    startDocDrag(event, docKey) {
      const deskEl = this.$refs.deskSurface;
      window.DeskDragManager.beginDrag(event, this.dragState, docKey, deskEl);
    },

    moveDocDrag(event) {
      if (!this.dragState.activeDocKey) return;
      const deskEl = this.$refs.deskSurface;
      const refMap = {
        passport: this.$refs.passportDoc,
        manifest: this.$refs.manifestDoc,
        rulebook: this.$refs.rulebookDoc,
        soapPrintout: this.$refs.soapPrintoutDoc,
        interpolSlip: this.$refs.interpolSlipDoc
      };
      const docEl = refMap[this.dragState.activeDocKey];
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
        this.currentSpeech = 'Officer, you have not stamped my passport yet! Drag it to the stamp bay on the right first.';
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
        this.currentSpeech = `Thank you. Please slide my ${remainingName} through the window slot as well.`;
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
      this.printedSoapSlip = null;
      this.isPrintingSoapSlip = false;
      this.interpolData = null;
      this.printedInterpolSlip = null;
      this.manualCommand = '';

      try {
        const res = await fetch('/api/inspections/next');
        this.passenger = await res.json();
        this.currentSpeech = 'Good day, officer. Click here or press [PAPERS, PLEASE] so I can hand over my documents.';
        this.recordRestTelemetry(this.passenger.rest_telemetry);
        this.terminalLogs.push({
          id: Date.now(),
          text: `BOOTH SENSOR: VISITOR AT WINDOW (${this.passenger.passenger_name.toUpperCase()})`,
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
      this.terminalLogs.push({ id: Date.now() + 1, text: `DISPATCHING SOAP 1.1 ENVELOPE TO WSDL ENDPOINT...`, isError: false });

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
          text: `XML RECEIVED (${this.mainframeData.soap_telemetry.bytes_received}B). SPOOLING TO DOT-MATRIX PRINTER...`,
          isError: false
        });

        setTimeout(() => {
          this.isPrintingSoapSlip = false;
          const deskWidth = this.$refs.deskSurface ? this.$refs.deskSurface.getBoundingClientRect().width : 1100;
          window.DeskDragManager.spawnSoapPrintoutPosition(this.dragState, deskWidth);
          if (rec && rec.name !== 'Unknown') {
            this.printedSoapSlip = {
              queriedIso: cleanIso,
              isFault: false,
              name: rec.name,
              capital: rec.capital,
              currency: rec.currency_code,
              phone: '+' + rec.phone_code,
              bytes: this.mainframeData.soap_telemetry.bytes_received,
              latency: this.mainframeData.soap_telemetry.latency_ms
            };
          } else {
            this.printedSoapSlip = {
              queriedIso: cleanIso,
              isFault: true,
              faultMessage: `SOAP FAULT: ISO '${cleanIso}' NOT IN WSDL SCHEMA`,
              bytes: this.mainframeData.soap_telemetry.bytes_received,
              latency: this.mainframeData.soap_telemetry.latency_ms
            };
          }
        }, 1400);

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

    async queryInterpol() {
      if (!this.passenger || this.isInterpolQuerying) return;
      this.isInterpolQuerying = true;
      window.ProceduralAudioEngine.playKeyClick();

      try {
        const res = await fetch(`/api/inspections/${this.passenger.inspection_id}/interpol-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passport_number: this.passenger.passport_number })
        });
        this.interpolData = await res.json();
        this.recordRestTelemetry(this.interpolData.rest_telemetry);
        window.DeskDragManager.spawnInterpolSlipPosition(this.dragState);
        this.printedInterpolSlip = {
          passportNumber: this.interpolData.passport_number,
          passengerName: this.interpolData.passenger_name,
          isWanted: this.interpolData.is_wanted,
          wantedReason: this.interpolData.wanted_reason || 'NO ACTIVE INTERNATIONAL WARRANTS'
        };
        if (this.interpolData.is_wanted) {
          window.ProceduralAudioEngine.playAlertBuzzer();
        } else {
          window.ProceduralAudioEngine.playSlotSlide();
        }
      } catch (err) {
      } finally {
        this.isInterpolQuerying = false;
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
      this.currentSpeech = 'Passport stamped ADMITTED! Now drag my Passport and Manifest up to the window slot to hand them back.';
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
      this.currentSpeech = 'Passport stamped DETAINED! Now drag my Passport and Manifest up to the window slot to return them.';
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
        this.currentSpeech = result.traveler_reaction;
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

    dismissModalAndNext() {
      this.verdictReport = null;
      this.loadNextTraveler();
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
