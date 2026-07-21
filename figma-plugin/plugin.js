// Design Library Builder — Figma Plugin
// Reads design-system.json and creates all variables, styles, and components.

figma.showUI(__html__, { width: 380, height: 540 });

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'import') return;
  const data = msg.data;
  if (!data) { figma.ui.postMessage({ type: 'error', message: 'No data received' }); return; }

  try {
    await runImport(data);
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: e.message || String(e) });
  }
};

function progress(pct, message, check, skip) {
  figma.ui.postMessage({ type: 'progress', pct, message, check, skip });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
  const clean = hex.replace('#', '');
  // Handle rgba(...) strings
  const rgbaMatch = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return { r: +rgbaMatch[1]/255, g: +rgbaMatch[2]/255, b: +rgbaMatch[3]/255, a: rgbaMatch[4] !== undefined ? +rgbaMatch[4] : 1 };
  }
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
}

function colorValue(c) {
  if (!c) return null;
  const s = String(c);
  if (s.startsWith('#') || s.startsWith('rgb')) return s;
  return null;
}

function safeFloat(v, fallback = 0) {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

// ── Variable Collections ──────────────────────────────────────────────────────

async function createVariableCollections(data) {
  const collections = data.variables?.collections || {};
  const results = {};
  const types = Object.keys(collections);

  for (let i = 0; i < types.length; i++) {
    const collName = types[i];
    const vars = collections[collName];
    if (!Array.isArray(vars) || !vars.length) continue;

    progress(10 + Math.round((i / types.length) * 20), `Creating variable collection: ${collName}`, null, null);

    // Find or create collection
    let coll = figma.variables.getLocalVariableCollections().find(c => c.name === collName);
    if (!coll) coll = figma.variables.createVariableCollection(collName);

    // Determine if this collection needs light/dark modes
    const needsModes = vars.some(v => v.lightValue && v.darkValue);
    let lightModeId = coll.defaultModeId;
    let darkModeId = null;

    if (needsModes) {
      // Rename default mode to Light
      try { coll.renameMode(lightModeId, 'Light'); } catch {}
      // Add Dark mode if not already present
      const darkMode = coll.modes.find(m => m.name === 'Dark');
      if (darkMode) { darkModeId = darkMode.modeId; }
      else { darkModeId = coll.addMode('Dark'); }
    }

    const collVars = {};

    for (const v of vars) {
      const resolvedType = v.resolvedType || (typeof v.value === 'number' ? 'FLOAT' : typeof v.value === 'boolean' ? 'BOOLEAN' : 'COLOR');
      let figType = resolvedType;
      if (!['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(figType)) {
        figType = typeof v.value === 'number' ? 'FLOAT' : typeof v.value === 'string' ? (colorValue(v.value) ? 'COLOR' : 'STRING') : 'STRING';
      }

      let figVar = figma.variables.getLocalVariables().find(fv => fv.name === v.name && fv.variableCollectionId === coll.id);
      if (!figVar) {
        try { figVar = figma.variables.createVariable(v.name, coll, figType); }
        catch { continue; }
      }

      if (v.description) try { figVar.description = v.description; } catch {}
      if (v.scopes && Array.isArray(v.scopes)) try { figVar.scopes = v.scopes; } catch {}
      if (v.hiddenFromPublishing !== undefined) try { figVar.hiddenFromPublishing = !!v.hiddenFromPublishing; } catch {}

      // Set values
      function setVal(modeId, rawVal) {
        if (rawVal === undefined || rawVal === null) return;
        try {
          if (figType === 'COLOR') {
            const cv = colorValue(rawVal);
            if (cv) figVar.setValueForMode(modeId, hexToRgb(cv));
          } else if (figType === 'FLOAT') {
            figVar.setValueForMode(modeId, safeFloat(rawVal));
          } else if (figType === 'BOOLEAN') {
            figVar.setValueForMode(modeId, !!rawVal);
          } else {
            figVar.setValueForMode(modeId, String(rawVal));
          }
        } catch {}
      }

      if (needsModes) {
        setVal(lightModeId, v.lightValue !== undefined ? v.lightValue : v.value);
        if (darkModeId) setVal(darkModeId, v.darkValue !== undefined ? v.darkValue : v.value);
      } else {
        setVal(lightModeId, v.value);
      }

      collVars[v.name] = figVar;
    }

    results[collName] = { coll, vars: collVars, lightModeId, darkModeId };
  }

  return results;
}

// ── Styles ────────────────────────────────────────────────────────────────────

async function createStyles(data) {
  const styles = data.styles || {};
  let count = 0;

  // Paint styles (colors)
  const colorItems = Array.isArray(styles.color) ? styles.color : [];
  for (const item of colorItems) {
    const cv = colorValue(item.color || item.value);
    if (!cv) continue;
    const existing = figma.getLocalPaintStyles().find(s => s.name === item.name);
    const style = existing || figma.createPaintStyle();
    style.name = item.name;
    if (item.description) style.description = item.description;
    const { r, g, b, a } = hexToRgb(cv);
    style.paints = [{ type: 'SOLID', color: { r, g, b }, opacity: a }];
    count++;
  }

  // Text styles
  const textItems = Array.isArray(styles.text) ? styles.text : [];
  for (const item of textItems) {
    if (!item.fontFamily || !item.fontSize) continue;
    const existing = figma.getLocalTextStyles().find(s => s.name === item.name);
    const style = existing || figma.createTextStyle();
    style.name = item.name;
    if (item.description) style.description = item.description;
    try {
      await figma.loadFontAsync({ family: item.fontFamily, style: item.fontStyle || (item.fontWeight >= 700 ? 'Bold' : item.fontWeight >= 500 ? 'Medium' : 'Regular') });
      style.fontName = { family: item.fontFamily, style: item.fontStyle || (item.fontWeight >= 700 ? 'Bold' : item.fontWeight >= 500 ? 'Medium' : 'Regular') };
    } catch {
      try {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        style.fontName = { family: 'Inter', style: 'Regular' };
      } catch {}
    }
    style.fontSize = safeFloat(item.fontSize, 14);
    if (item.lineHeight) style.lineHeight = { value: safeFloat(item.lineHeight), unit: 'PIXELS' };
    if (item.letterSpacing) style.letterSpacing = { value: safeFloat(item.letterSpacing), unit: 'PIXELS' };
    if (item.textTransform) style.textCase = item.textTransform === 'uppercase' ? 'UPPER' : item.textTransform === 'lowercase' ? 'LOWER' : 'ORIGINAL';
    count++;
  }

  // Effect styles (shadows, blurs)
  const effectItems = Array.isArray(styles.effects) ? styles.effects : [];
  for (const item of effectItems) {
    if (!item.name) continue;
    const existing = figma.getLocalEffectStyles().find(s => s.name === item.name);
    const style = existing || figma.createEffectStyle();
    style.name = item.name;
    if (item.description) style.description = item.description;
    const effects = [];
    if (item.shadows && Array.isArray(item.shadows)) {
      for (const sh of item.shadows) {
        const { r, g, b } = hexToRgb(sh.color || '#000000');
        const alpha = sh.alpha !== undefined ? safeFloat(sh.alpha) : 0.1;
        effects.push({
          type: sh.type === 'inner' ? 'INNER_SHADOW' : 'DROP_SHADOW',
          color: { r, g, b, a: alpha },
          offset: { x: safeFloat(sh.x), y: safeFloat(sh.y) },
          radius: safeFloat(sh.blur),
          spread: safeFloat(sh.spread),
          visible: true, blendMode: 'NORMAL',
        });
      }
    }
    if (item.blur !== undefined) {
      effects.push({ type: 'LAYER_BLUR', radius: safeFloat(item.blur), visible: true });
    }
    if (effects.length) style.effects = effects;
    count++;
  }

  // Grid styles
  const gridItems = Array.isArray(styles.grids) ? styles.grids : [];
  for (const item of gridItems) {
    if (!item.name) continue;
    const existing = figma.getLocalGridStyles().find(s => s.name === item.name);
    const style = existing || figma.createGridStyle();
    style.name = item.name;
    if (item.description) style.description = item.description;
    const grids = [];
    if (item.columns) {
      grids.push({ pattern: 'COLUMNS', count: safeFloat(item.columns, 12), sectionSize: safeFloat(item.columnWidth, 72), gutterSize: safeFloat(item.gutter, 24), offset: safeFloat(item.margin, 24), alignment: 'STRETCH', color: { r: 0.7, g: 0.7, b: 1, a: 0.1 }, visible: true });
    }
    if (grids.length) style.grids = grids;
    count++;
  }

  return count;
}

// ── Components ────────────────────────────────────────────────────────────────

async function createComponents(data, variableResults) {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  const meta = data.meta || {};
  const primary = meta.primaryColor || '#6366F1';
  const primaryRgb = hexToRgb(primary);
  const radius = safeFloat(meta.buttonRadius, 6);
  const cardRadius = safeFloat(meta.cardRadius, 12);
  const components = data.components || [];

  // Find or create a library page
  let libPage = figma.root.children.find(p => p.name === '📚 Component Library');
  if (!libPage) {
    libPage = figma.createPage();
    libPage.name = '📚 Component Library';
  }
  figma.currentPage = libPage;

  const COLS = 4;
  const CARD_W = 220;
  const CARD_H = 140;
  const GAP = 24;
  let col = 0, row = 0;

  function nextPos() {
    const x = col * (CARD_W + GAP);
    const y = row * (CARD_H + GAP);
    col++;
    if (col >= COLS) { col = 0; row++; }
    return { x, y };
  }

  // Section headers per tier
  const tiers = ['atom', 'molecule', 'organism', 'pattern'];
  const tierSections = {};

  function ensureTierSection(tier) {
    if (tierSections[tier]) return;
    const label = figma.createText();
    label.characters = tier.charAt(0).toUpperCase() + tier.slice(1) + 's';
    label.fontSize = 18;
    label.fontName = { family: 'Inter', style: 'Bold' };
    label.fills = [{ type: 'SOLID', color: { r: 0.07, g: 0.09, b: 0.15 } }];
    label.x = col * (CARD_W + GAP);
    label.y = row * (CARD_H + GAP) - 32;
    libPage.appendChild(label);
    tierSections[tier] = true;
  }

  let created = 0;

  for (let idx = 0; idx < components.length; idx++) {
    const c = components[idx];
    const tier = (c.tier || 'atom').toLowerCase();

    // Group by tier
    if (!tierSections[tier]) {
      if (col !== 0) { col = 0; row++; }
      row++;
      ensureTierSection(tier);
    }

    const { x, y } = nextPos();
    const type = detectComponentType(c.name, c.category, c.tier);
    const frame = buildComponentFrame(c, type, primary, primaryRgb, radius, cardRadius);
    frame.x = x;
    frame.y = y;
    libPage.appendChild(frame);
    created++;

    if (idx % 4 === 0) {
      progress(60 + Math.round((idx / Math.max(components.length, 1)) * 30), `Creating component ${idx + 1}/${components.length}: ${c.name}`, null, null);
    }
  }

  return created;
}

function detectComponentType(name, category, tier) {
  const n = (name || '').toLowerCase();
  const cat = (category || '').toLowerCase();
  if (/checkbox|check/.test(n) || cat === 'checkbox') return 'checkbox';
  if (/toggle|switch/.test(n)) return 'toggle';
  if (/radio/.test(n)) return 'radio';
  if (/avatar|profile/.test(n)) return 'avatar';
  if (/badge|tag|chip|pill/.test(n)) return 'badge';
  if (/input|text.*field|search/.test(n) || cat === 'input') return 'input';
  if (/select|dropdown/.test(n)) return 'select';
  if (/textarea/.test(n)) return 'textarea';
  if (/progress|spinner|loading/.test(n)) return 'progress';
  if (/toast|alert|notification/.test(n)) return 'alert';
  if (/tooltip/.test(n)) return 'tooltip';
  if (/modal|dialog/.test(n)) return 'modal';
  if (/accordion|collapse/.test(n)) return 'accordion';
  if (/tab/.test(n)) return 'tabs';
  if (/nav|menu|sidebar/.test(n)) return 'nav';
  if (/icon/.test(n)) return 'icon';
  if (/divider|separator/.test(n)) return 'divider';
  if (/card/.test(n) || tier === 'molecule' || tier === 'organism') return 'card';
  if (/table|list/.test(n)) return 'table';
  return 'button';
}

function buildComponentFrame(c, type, primary, primaryRgb, radius, cardRadius) {
  const frame = figma.createFrame();
  frame.name = c.name;
  frame.resize(CARD_W, CARD_H);
  frame.cornerRadius = 8;
  frame.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.98, b: 0.99 } }];
  frame.strokes = [{ type: 'SOLID', color: { r: 0.89, g: 0.91, b: 0.94 } }];
  frame.strokeWeight = 1;

  // Label at top
  const label = figma.createText();
  label.characters = c.name;
  label.fontSize = 11;
  label.fontName = { family: 'Inter', style: 'Medium' };
  label.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.45, b: 0.55 } }];
  label.x = 12;
  label.y = 10;
  frame.appendChild(label);

  const tierBadge = figma.createText();
  tierBadge.characters = (c.tier || 'atom').toUpperCase();
  tierBadge.fontSize = 9;
  tierBadge.fontName = { family: 'Inter', style: 'Bold' };
  tierBadge.fills = [{ type: 'SOLID', color: primaryRgb }];
  tierBadge.x = 12;
  tierBadge.y = 24;
  frame.appendChild(tierBadge);

  // Component preview in center area
  const previewY = 48;
  const previewH = CARD_H - previewY - 12;

  function addRect(x, y, w, h, color, cornerR) {
    const r = figma.createRectangle();
    r.x = x; r.y = y; r.resize(w, h);
    r.fills = [{ type: 'SOLID', color }];
    if (cornerR) r.cornerRadius = cornerR;
    frame.appendChild(r);
    return r;
  }

  function addText(txt, x, y, size, bold, color) {
    const t = figma.createText();
    t.characters = String(txt);
    t.fontSize = size || 12;
    t.fontName = { family: 'Inter', style: bold ? 'Bold' : 'Regular' };
    t.fills = [{ type: 'SOLID', color: color || { r: 0.07, g: 0.09, b: 0.15 } }];
    t.x = x; t.y = y;
    frame.appendChild(t);
    return t;
  }

  const cx = CARD_W / 2;

  if (type === 'checkbox') {
    const box = figma.createRectangle();
    box.resize(16, 16); box.x = cx - 40; box.y = previewY + 18;
    box.cornerRadius = 3;
    box.fills = [{ type: 'SOLID', color: primaryRgb }];
    box.strokes = [{ type: 'SOLID', color: primaryRgb }];
    box.strokeWeight = 2;
    frame.appendChild(box);
    addText('✓', cx - 38, previewY + 16, 12, true, { r: 1, g: 1, b: 1 });
    addText(c.name, cx - 20, previewY + 18, 13, false, { r: 0.07, g: 0.09, b: 0.15 });

  } else if (type === 'toggle') {
    const track = addRect(cx - 28, previewY + 20, 40, 22, primaryRgb, 11);
    const thumb = addRect(cx - 28 + 21, previewY + 23, 16, 16, { r: 1, g: 1, b: 1 }, 8);
    addText(c.name, cx - 28, previewY + 46, 11, false, { r: 0.4, g: 0.45, b: 0.55 });

  } else if (type === 'radio') {
    const circle = figma.createEllipse();
    circle.resize(18, 18); circle.x = cx - 40; circle.y = previewY + 18;
    circle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    circle.strokes = [{ type: 'SOLID', color: primaryRgb }];
    circle.strokeWeight = 2;
    frame.appendChild(circle);
    const dot = figma.createEllipse();
    dot.resize(8, 8); dot.x = cx - 35; dot.y = previewY + 23;
    dot.fills = [{ type: 'SOLID', color: primaryRgb }];
    frame.appendChild(dot);
    addText(c.name, cx - 18, previewY + 18, 13, false, { r: 0.07, g: 0.09, b: 0.15 });

  } else if (type === 'avatar') {
    const circle = figma.createEllipse();
    circle.resize(44, 44); circle.x = cx - 22; circle.y = previewY + 4;
    circle.fills = [{ type: 'SOLID', color: primaryRgb }];
    frame.appendChild(circle);
    const initials = c.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'AV';
    addText(initials, cx - 11, previewY + 14, 16, true, { r: 1, g: 1, b: 1 });
    addText(c.name, cx - 24, previewY + 54, 11, false, { r: 0.4, g: 0.45, b: 0.55 });

  } else if (type === 'badge') {
    const pill = addRect(cx - 32, previewY + 22, 64, 22, { r: primaryRgb.r, g: primaryRgb.g, b: primaryRgb.b }, 11);
    addText(c.name.slice(0, 8), cx - 24, previewY + 25, 11, true, { r: 1, g: 1, b: 1 });

  } else if (type === 'input') {
    addRect(cx - 80, previewY + 10, 160, 36, { r: 1, g: 1, b: 1 }, radius);
    const border = figma.createRectangle();
    border.resize(160, 36); border.x = cx - 80; border.y = previewY + 10;
    border.fills = [];
    border.strokes = [{ type: 'SOLID', color: primaryRgb }];
    border.strokeWeight = 1.5; border.cornerRadius = radius;
    frame.appendChild(border);
    addText(c.name + '…', cx - 70, previewY + 20, 12, false, { r: 0.6, g: 0.65, b: 0.7 });

  } else if (type === 'select') {
    addRect(cx - 75, previewY + 12, 150, 36, { r: 1, g: 1, b: 1 }, radius);
    const border2 = figma.createRectangle();
    border2.resize(150, 36); border2.x = cx - 75; border2.y = previewY + 12;
    border2.fills = []; border2.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.91, b: 0.94 } }];
    border2.strokeWeight = 1; border2.cornerRadius = radius;
    frame.appendChild(border2);
    addText('Select…', cx - 65, previewY + 22, 12, false, { r: 0.6, g: 0.65, b: 0.7 });
    addText('▾', cx + 44, previewY + 22, 12, false, { r: 0.6, g: 0.65, b: 0.7 });

  } else if (type === 'progress') {
    addRect(cx - 75, previewY + 26, 150, 8, { r: 0.9, g: 0.92, b: 0.95 }, 4);
    addRect(cx - 75, previewY + 26, 95, 8, primaryRgb, 4);
    addText('65%', cx - 75, previewY + 40, 10, false, { r: 0.4, g: 0.45, b: 0.55 });

  } else if (type === 'alert') {
    addRect(cx - 80, previewY + 8, 160, 48, { r: 0.94, g: 0.97, b: 1 }, radius);
    addText('ℹ', cx - 68, previewY + 22, 14, false, { r: 0.11, g: 0.3, b: 0.87 });
    addText(c.name.slice(0, 16), cx - 50, previewY + 22, 12, true, { r: 0.11, g: 0.3, b: 0.87 });

  } else if (type === 'tooltip') {
    addRect(cx - 50, previewY + 8, 100, 28, { r: 0.12, g: 0.15, b: 0.22 }, 6);
    addText(c.name.slice(0, 10), cx - 40, previewY + 16, 11, false, { r: 1, g: 1, b: 1 });

  } else if (type === 'modal') {
    addRect(cx - 75, previewY + 4, 150, 90, { r: 1, g: 1, b: 1 }, 10);
    addText(c.name, cx - 60, previewY + 14, 12, true, { r: 0.07, g: 0.09, b: 0.15 });
    addRect(cx - 62, previewY + 66, 54, 20, { r: primaryRgb.r, g: primaryRgb.g, b: primaryRgb.b }, radius);
    addText('Confirm', cx - 56, previewY + 70, 10, true, { r: 1, g: 1, b: 1 });

  } else if (type === 'tabs') {
    const tabs = ['Overview', 'Details', 'More'];
    tabs.forEach((tab, i) => {
      const tw = 60, tx = cx - 90 + i * (tw + 4);
      if (i === 0) {
        addRect(tx, previewY + 14, tw, 28, { r: primaryRgb.r * 0.15 + 0.85, g: primaryRgb.g * 0.15 + 0.85, b: primaryRgb.b * 0.15 + 0.85 }, 4);
      }
      addText(tab, tx + 8, previewY + 20, 11, i === 0, i === 0 ? primaryRgb : { r: 0.5, g: 0.55, b: 0.6 });
    });

  } else if (type === 'accordion') {
    addRect(cx - 80, previewY + 12, 160, 36, { r: 1, g: 1, b: 1 }, radius);
    addText(c.name, cx - 68, previewY + 22, 12, true, { r: 0.07, g: 0.09, b: 0.15 });
    addText('▾', cx + 48, previewY + 22, 12, false, { r: 0.5, g: 0.55, b: 0.6 });

  } else if (type === 'card') {
    addRect(cx - 75, previewY + 6, 150, 82, { r: 1, g: 1, b: 1 }, cardRadius);
    addText(c.name, cx - 60, previewY + 18, 12, true, { r: 0.07, g: 0.09, b: 0.15 });
    addText(c.description || 'Card content', cx - 60, previewY + 34, 10, false, { r: 0.4, g: 0.45, b: 0.55 });

  } else if (type === 'table') {
    const headers = ['Name', 'Status', 'Date'];
    headers.forEach((h, i) => addText(h, cx - 76 + i * 54, previewY + 10, 9, true, { r: 0.4, g: 0.45, b: 0.55 }));
    addRect(cx - 80, previewY + 22, 160, 1, { r: 0.88, g: 0.91, b: 0.94 }, 0);
    addText('Item A', cx - 76, previewY + 28, 11, false, { r: 0.07, g: 0.09, b: 0.15 });

  } else if (type === 'nav') {
    const navItems = ['Home', 'Library', 'Settings'];
    navItems.forEach((item, i) => {
      if (i === 0) addRect(cx - 82 + i * 56, previewY + 14, 52, 24, { r: primaryRgb.r * 0.15 + 0.85, g: primaryRgb.g * 0.15 + 0.85, b: primaryRgb.b * 0.15 + 0.85 }, 6);
      addText(item, cx - 76 + i * 56, previewY + 20, 10, i === 0, i === 0 ? primaryRgb : { r: 0.5, g: 0.55, b: 0.6 });
    });

  } else if (type === 'icon') {
    const iconBg = addRect(cx - 20, previewY + 14, 40, 40, { r: primaryRgb.r * 0.1 + 0.9, g: primaryRgb.g * 0.1 + 0.9, b: primaryRgb.b * 0.1 + 0.9 }, 8);
    addText('◈', cx - 8, previewY + 24, 18, true, primaryRgb);

  } else if (type === 'divider') {
    addRect(cx - 80, previewY + 34, 160, 1, { r: 0.88, g: 0.91, b: 0.94 }, 0);
    addText(c.name, cx - 30, previewY + 40, 10, false, { r: 0.6, g: 0.65, b: 0.7 });

  } else {
    // Default: Button
    const isSecondary = (c.name || '').toLowerCase().includes('secondary') || (c.name || '').toLowerCase().includes('ghost');
    const btnFill = isSecondary ? { r: 1, g: 1, b: 1 } : primaryRgb;
    const btnW = Math.min(130, c.name.length * 8 + 32);
    const btn = addRect(cx - btnW / 2, previewY + (previewH / 2) - 18, btnW, 36, btnFill, radius);
    if (isSecondary) {
      btn.strokes = [{ type: 'SOLID', color: primaryRgb }];
      btn.strokeWeight = 1;
    }
    addText(c.name.slice(0, 14), cx - btnW / 2 + 12, previewY + (previewH / 2) - 7, 13, true, isSecondary ? primaryRgb : { r: 1, g: 1, b: 1 });
  }

  return frame;
}

const CARD_W = 220;
const CARD_H = 140;

// ── Main import flow ──────────────────────────────────────────────────────────

async function runImport(data) {
  const meta = data.meta || {};
  const name = meta.name || 'Design System';

  progress(5, 'Starting import of "' + name + '"…', null, null);

  // Step 1: Variables
  progress(8, 'Creating variable collections…', null, null);
  let variableResults = {};
  try {
    variableResults = await createVariableCollections(data);
    const collCount = Object.keys(variableResults).length;
    progress(35, `Created ${collCount} variable collection(s)`, 'vars', false);
  } catch (e) {
    progress(35, 'Variables: ' + e.message + ' (continuing)', 'vars', true);
  }

  // Step 2: Styles
  progress(38, 'Creating paint, text, and effect styles…', null, null);
  let styleCount = 0;
  try {
    styleCount = await createStyles(data);
    progress(58, `Created ${styleCount} styles`, 'styles', false);
  } catch (e) {
    progress(58, 'Styles: ' + e.message + ' (continuing)', 'styles', true);
  }

  // Step 3: Components
  progress(60, 'Creating component frames…', null, null);
  let compCount = 0;
  try {
    compCount = await createComponents(data, variableResults);
    progress(92, `Created ${compCount} component(s)`, 'comps', compCount === 0);
  } catch (e) {
    progress(92, 'Components: ' + e.message + ' (continuing)', 'comps', true);
  }

  // Step 4: Organize
  progress(95, 'Finalizing library page…', 'page', false);

  const summary = [
    `• ${Object.keys(variableResults).length} variable collection(s)`,
    `• ${styleCount} style(s)`,
    `• ${compCount} component(s)`,
    `• Library page: 📚 Component Library`,
  ].join('\n');

  figma.ui.postMessage({ type: 'done', summary });
}
