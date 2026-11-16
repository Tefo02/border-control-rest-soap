window.customsGameApp = function () {
  return {
    passenger: null,
    mainframeData: null,
    interpolData: null,
    activeWindow: 'mainframe',
    activeTelemetryTab: 'metrics',
    manualCommand: '',
    dragState: window.DeskDragManager.createInitialState(),
    terminalLogs: [
      { id: 1, text: 'IBM OS/390 CICS ONLINE. ENTER "QUERY <ISO>" OR COUNTRY CODE.', isError: false }
    ],
    score: 0,
    inspectionsCount: 0,
    correctCount: 0,
    accuracyRate: 100,
    isQuerying: false,
    isInterpolQuerying: false,
    isSubmitting: false,
    verdictStamp: null,
    verdictModal: null,

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
        if (this.verdictModal && event.key === 'Enter') {
          event.preventDefault();
          this.dismissModalAndNext();
          return;
        }
        if (this.isSubmitting || this.verdictStamp !== null || !this.passenger) {
          return;
        }
        const upperKey = event.key.toUpperCase();
        if (upperKey === 'A') {
          event.preventDefault();
          this.submitDecision('APPROVE');
        } else if (upperKey === 'D') {
          event.preventDefault();
          this.submitDecision('DENY');
        }
      });
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

    async loadNextTraveler() {
      this.verdictStamp = null;
      this.mainframeData = null;
      this.interpolData = null;
      this.manualCommand = '';
      window.DeskDragManager.resetPositions(this.dragState);

      try {
        const res = await fetch('/api/inspections/next');
        this.passenger = await res.json();
        this.terminalLogs.push({
          id: Date.now(),
          text: `NEW ARRIVAL: ${this.passenger.passenger_name.toUpperCase()} [DOC: ${this.passenger.passport_number}]`,
          isError: false
        });
        window.ProceduralAudioEngine.playPaperRustle();
        this.$nextTick(() => {
          if (window.hljs) window.hljs.highlightAll();
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
        const rec = this.mainframeData.canonical_record;
        if (rec && rec.name !== 'Unknown') {
          this.terminalLogs.push({
            id: Date.now() + 2,
            text: `WSDL MATCH: ${rec.name} | CAP: ${rec.capital} | CURR: ${rec.currency_code} | DDI: +${rec.phone_code}`,
            isError: false
          });
          window.ProceduralAudioEngine.playKeyClick();
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
          if (window.hljs) window.hljs.highlightAll();
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
        if (this.interpolData.is_wanted) {
          window.ProceduralAudioEngine.playAlertBuzzer();
        } else {
          window.ProceduralAudioEngine.playKeyClick();
        }
        this.$nextTick(() => {
          if (window.hljs) window.hljs.highlightAll();
        });
      } catch (err) {
      } finally {
        this.isInterpolQuerying = false;
      }
    },

    async submitDecision(decision) {
      if (!this.passenger || this.isSubmitting || this.verdictStamp !== null) return;
      this.isSubmitting = true;
      window.DeskDragManager.bringToFront(this.dragState, 'passport');
      this.verdictStamp = decision;
      window.ProceduralAudioEngine.playStampImpact();

      try {
        const res = await fetch(`/api/inspections/${this.passenger.inspection_id}/verdict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision })
        });
        const result = await res.json();
        this.score += result.score_delta;
        this.inspectionsCount++;
        if (result.is_correct) this.correctCount++;
        this.accuracyRate = Math.round((this.correctCount / this.inspectionsCount) * 100);

        setTimeout(() => {
          this.verdictModal = result;
          if (!result.is_correct) {
            window.ProceduralAudioEngine.playAlertBuzzer();
          } else {
            window.ProceduralAudioEngine.playKeyClick();
          }
        }, 650);
      } catch (err) {
      } finally {
        this.isSubmitting = false;
      }
    },

    dismissModalAndNext() {
      this.verdictModal = null;
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
