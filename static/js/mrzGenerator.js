window.MrzAndBarcodeGenerator = {
  padField(rawText, targetLength) {
    const sanitized = String(rawText || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '<');
    if (sanitized.length >= targetLength) {
      return sanitized.substring(0, targetLength);
    }
    return sanitized + '<'.repeat(targetLength - sanitized.length);
  },

  computeCheckDigit(inputString) {
    const weights = [7, 3, 1];
    let sum = 0;
    for (let index = 0; index < inputString.length; index++) {
      const charCode = inputString.charCodeAt(index);
      let value = 0;
      if (charCode >= 48 && charCode <= 57) {
        value = charCode - 48;
      } else if (charCode >= 65 && charCode <= 90) {
        value = charCode - 55;
      }
      sum += value * weights[index % 3];
    }
    return String(sum % 10);
  },

  formatCompactDate(isoDateString) {
    if (!isoDateString || isoDateString.length < 10) {
      return '990101';
    }
    const clean = isoDateString.replace(/-/g, '');
    return clean.substring(2, 8);
  },

  generatePassportMrzLines(passenger) {
    if (!passenger) {
      return ['P<UTO<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<', '0000000000UTO0000000M0000000<<<<<<<<<<<<<<00'];
    }
    const iso3 = this.padField(passenger.declared_iso_code, 3);
    const nameParts = String(passenger.passenger_name || 'TRAVELER UNKNOWN')
      .toUpperCase()
      .trim()
      .split(/\s+/);
    const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
    const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1).join('<') : 'VISITOR';
    const line1Body = `P<${iso3}${surname}<<${givenNames}`;
    const line1 = this.padField(line1Body, 44);

    const passportNumber = this.padField(passenger.passport_number || 'P00000000', 9);
    const passportCheck = this.computeCheckDigit(passportNumber);
    const birthCompact = this.formatCompactDate(passenger.birth_date);
    const birthCheck = this.computeCheckDigit(birthCompact);
    const expiryCompact = this.formatCompactDate(passenger.expiration_date);
    const expiryCheck = this.computeCheckDigit(expiryCompact);
    const personalNumber = this.padField(passenger.inspection_id || '0000', 14);
    const personalCheck = this.computeCheckDigit(personalNumber);

    const line2Raw = `${passportNumber}${passportCheck}${iso3}${birthCompact}${birthCheck}M${expiryCompact}${expiryCheck}${personalNumber}${personalCheck}`;
    const finalCheck = this.computeCheckDigit(line2Raw);
    const line2 = this.padField(`${line2Raw}${finalCheck}`, 44);

    return [line1, line2];
  },

  generateBarcodeRectangles(seedValue) {
    const cleanSeed = String(seedValue || 'DEFAULT-INSPECTION-SEED');
    const bars = [];
    let currentX = 4;
    for (let index = 0; index < 34; index++) {
      const code = cleanSeed.charCodeAt(index % cleanSeed.length) + index * 17;
      const width = (code % 3) + 1.5;
      const gap = ((code >> 2) % 3) + 1.5;
      bars.push({ x: currentX, width });
      currentX += width + gap;
    }
    return bars;
  }
};
