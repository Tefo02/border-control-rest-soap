window.customsGameApp = function () {
  return {
    passenger: null,
    currentSpeech: '',
    activeInterrogationTopic: null,
    mainframeData: null,
    teletypeVisibleFields: 0,
    interpolData: null,
    faultSimulationData: null,
    activeWindow: 'mainframe',
    activeTelemetryTab: 'metrics',
    isDevDrawerOpen: false,
    showCitationPicker: false,
    manualCommand: '',
    dragState: window.DeskDragManager.createInitialState(),
    terminalLogs: [
      { id: 1, text: 'IBM OS/390 CICS ONLINE. ENTER "QUERY <ISO>" OR COUNTRY CODE.', isError: false }
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
        if (this.isSubmitting || this.verdictStamp !== null || !this.passenger) {
          return;
        }
        const upperKey = event.key.toUpperCase();
        if (upperKey === 'A') {
          event.preventDefault();
          this.submitDecision('APPROVE', null);
        } else if (upperKey === 'D') {
          event.preventDefault();
          this.openDenialCitationPicker();
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

    askTraveler(topicKey) {
      if (!this.passenger || !this.passenger.interrogation_responses) return;
      const answer = this.passenger.interrogation_responses[topicKey];
      if (!answer) return;
      this.activeInterrogationTopic = topicKey;
      this.currentSpeech = answer;
      window.ProceduralAudioEngine.playKeyClick();
    },

    openDenialCitationPicker() {
      if (!this.passenger || this.isSubmitting || this.verdictStamp !== null) return;
      this.showCitationPicker = true;
      window.ProceduralAudioEngine.playKeyClick();
    },

    confirmDenialWithCategory(categoryCode) {
      this.showCitationPicker = false;
      this.submitDecision('DENY', categoryCode);
    },

    startDocDrag(event, docKey) {
      const deskEl = this.$refs.deskSurface;
      window.DeskDragManager.beginDrag(event, this.dragState, docKey, deskEl);
    },

    moveDocDrag(event) {
      if (!this.dragState.activeDocKey) return;
      const deskEl = this.$refs.deskSurface;
      const activeKey = this.dragState.activeDocKey;
      const docEl = activeKey === 'passport' ? this.$refs.passportDoc : this.$refs.manifestDoc;
      window.DeskDragManager.updateDrag(event, this.dragState, deskEl, docEl);
    },

    stopDocDrag(event) {
      window.DeskDragManager.endDrag(event, this.dragState);
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
      this.activeInterrogationTopic = null;
      this.mainframeData = null;
      this.teletypeVisibleFields = 0;
      this.interpolData = null;
      this.manualCommand = '';
      window.DeskDragManager.resetPositions(this.dragState);

      try {
        const res = await fetch('/api/inspections/next');
        this.passenger = await res.json();
        this.currentSpeech = this.passenger.dialogue_speech;
        this.recordRestTelemetry(this.passenger.rest_telemetry);
        this.terminalLogs.push({
          id: Date.now(),
          text: `ARRIVAL: ${this.passenger.passenger_name.toUpperCase()} [DOC: ${this.passenger.passport_number}]`,
          isError: false
        });
        window.ProceduralAudioEngine.playPaperRustle();
        this.$nextTick(() => {
          if (window.hljs && this.isDevDrawerOpen) window.hljs.highlightAll();
        });
      } catch (err) {}
    },

    runTeletypeReveal(record, bytesCount) {
      this.teletypeVisibleFields = 0;
      const steps = [
        `DECODING SOAP XML ENVELOPE [${bytesCount} BYTES] AT 9600 BPS...`,
        `  -> <m:sName>${record.name} (${record.iso_code})</m:sName>`,
        `  -> <m:sCapitalCity>${record.capital}</m:sCapitalCity>`,
        `  -> <m:sCurrencyISOCode>${record.currency_code}</m:sCurrencyISOCode> | DDI: +${record.phone_code}`
      ];
      steps.forEach((lineText, idx) => {
        setTimeout(() => {
          this.teletypeVisibleFields = idx + 1;
          this.terminalLogs.push({
            id: Date.now() + idx,
            text: lineText,
            isError: false
          });
          window.ProceduralAudioEngine.playKeyClick();
        }, (idx + 1) * 120);
      });
    },

    async executeManualSoapQuery() {
      const raw = this.manualCommand.trim().toUpperCase();
      if (!raw || this.isQuerying || !this.passenger) return;
      const cleanIso = raw.replace('QUERY', '').replace('ISO', '').trim();
      this.isQuerying = true;
      this.teletypeVisibleFields = 0;
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
        if (rec && rec.name !== 'Unknown') {
          this.runTeletypeReveal(rec, this.mainframeData.soap_telemetry.bytes_received);
        } else {
          this.terminalLogs.push({
            id: Date.now() + 2,
            text: `SOAP FAULT: NO CANONICAL RECORD FOR ISO '${cleanIso}'`,
            isError: true
          });
          window.ProceduralAudioEngine.playAlertBuzzer();
        }
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
        if (this.interpolData.is_wanted) {
          window.ProceduralAudioEngine.playAlertBuzzer();
        } else {
          window.ProceduralAudioEngine.playKeyClick();
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

    async submitDecision(decision, violationCategory) {
      if (!this.passenger || this.isSubmitting || this.verdictStamp !== null) return;
      this.isSubmitting = true;
      this.showCitationPicker = false;
      window.DeskDragManager.bringToFront(this.dragState, 'passport');
      this.verdictStamp = decision;
      window.ProceduralAudioEngine.playStampImpact();

      try {
        const res = await fetch(`/api/inspections/${this.passenger.inspection_id}/verdict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            violation_category: violationCategory
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
