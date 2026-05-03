/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Gamepad2, 
  FileUp, 
  Loader2, 
  ListChecks, 
  History, 
  Copy, 
  Check, 
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import unitData from './units.json';
import unitImagesData from './units_data.json';

const unitImagesLower = Object.entries(unitImagesData).reduce((acc, [key, value]) => {
  acc[key.toLowerCase()] = value as string;
  return acc;
}, {} as Record<string, string>);

interface ParsedUnit {
  unitId: string;
  prefix: string;
}

interface FactionInfo {
  name: string;
  color: string;
  bg: string;
  border: string;
}

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [results, setResults] = useState<ParsedUnit[]>([]);
  const [factionFilter, setFactionFilter] = useState<'ALL' | 'Armada' | 'Cortex' | 'Legion' | 'Scavenger' | 'Events' | 'Other'>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFactionInfo = (unitId: string): FactionInfo => {
    const id = unitId.toLowerCase();
    if (id.startsWith('arm')) {
      return { name: 'Armada', color: 'text-blue-300', bg: 'bg-blue-900/40', border: 'border-blue-500/50' };
    }
    if (id.startsWith('cor')) {
      return { name: 'Cortex', color: 'text-red-300', bg: 'bg-red-900/40', border: 'border-red-500/50' };
    }
    if (id.startsWith('leg')) {
      return { name: 'Legion', color: 'text-green-300', bg: 'bg-green-900/40', border: 'border-green-500/50' };
    }
    if (id.startsWith('scav') || id.startsWith('squad') || id.startsWith('babyleg')) {
      return { name: 'Scavenger', color: 'text-purple-300', bg: 'bg-purple-900/40', border: 'border-purple-500/50' };
    }
    if (id.startsWith('loot') || id.startsWith('xmas') || id.startsWith('dice') || id.startsWith('critter')) {
      return { name: 'Events', color: 'text-yellow-300', bg: 'bg-yellow-900/40', border: 'border-yellow-500/50' };
    }
    return { name: 'Other', color: 'text-slate-300', bg: 'bg-slate-800/40', border: 'border-slate-500/50' };
  };

  const getUnitName = (unitId: string): string => {
    const rawName = (unitData.units.names as Record<string, string>)[unitId.toLowerCase()];
    return rawName || 'Unknown Unit';
  };

  const getUnitDescription = (unitId: string): string => {
    const rawDesc = (unitData.units.descriptions as Record<string, string>)[unitId.toLowerCase()];
    return rawDesc || 'No description available';
  };

  const getUnitImage = (unitId: string): string | null => {
    const name = getUnitName(unitId).toLowerCase();
    return unitImagesLower[name] || null;
  };

  const getPrefixColorClass = (prefix: string) => {
    const p = prefix.toLowerCase();
    
    if (p.includes('cursed') || p.includes('malicious')) return 'text-red-500 font-bold';
    
    if (p.includes('mggw') || p.includes('ambo') || p.includes('beyond') || p.includes('super sayan') || p.includes('error') || p.includes(' god ') || p === 'god' || p.includes('admin')) {
      return 'text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 font-black text-[18px] uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]';
    }
    if (p.includes('dope') || p.includes('insanely lucky') || p.includes('toorng') || p.includes('godlike')) {
      return 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 font-black text-[17px] uppercase tracking-wide';
    }
    if (p.includes('absurd') || p.includes('immortal') || p.includes('jackpot')) {
      return 'text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 font-black text-[16px] drop-shadow-md';
    }
    if (p.includes('unique') || p.includes('omega') || p.includes('supreme')) {
      return 'text-rose-400 font-black text-[16px]';
    }
    if (p.includes('eternal') || p.includes('divine') || p.includes('miracle')) {
      return 'text-orange-400 font-black italic text-[15px]';
    }
    if (p.includes('mythical') || p.includes('legendary')) {
      return 'text-yellow-400 font-black text-[15px]';
    }
    if (p.includes('exotic') || p.includes('epic')) {
      return 'text-purple-400 font-bold text-[14px]';
    }
    if (p.includes('exceptional')) return 'text-teal-400 font-bold';
    if (p.includes('rare')) return 'text-blue-400 font-semibold';
    if (p.includes('uncommon')) return 'text-green-400 font-medium';
    if (p.includes('common') || p.includes('standard')) return 'text-slate-400';

    return 'text-slate-300';
  };

  const processFile = (file: File) => {
    setResults([]);
    setError(null);
    
    if (!file.name.endsWith('.txt')) {
      setError("Vui lòng tải lên file dạng .txt (infolog.txt).");
      return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseLogContent(content);
    };
    reader.onerror = () => {
      setError("Có lỗi xảy ra khi đọc file.");
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const parseLogContent = (content: string) => {
    const lines = content.split(/\r?\n/);
    
    // Dùng Map để lưu, giúp tự động gộp dữ liệu từ nhiều block 
    // và lọc trùng lặp unit (nếu log lặp lại)
    const currentMatchMap = new Map<string, ParsedUnit>();
    let isListing = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Phát hiện khi game khởi động lại hoặc load map mới
      // Xóa toàn bộ dữ liệu cũ để không bị lẫn log của trận trước
      if (line.includes('LogOutput initialized') || 
          line.includes('Loading map') || 
          line.includes('============== <App>')) {
        currentMatchMap.clear();
        isListing = false;
      }

      if (line.includes('tweakdefs_rename_get_ready')) {
        isListing = true;
      } else if (line.includes('tweakdefs_rename_end')) {
        isListing = false;
      } else if (isListing) {
        // Dùng Regex để tách đúng định dạng /(unitId/-prefix/-[ModName])/
        const match = line.match(/\/\((.*?)\/-(.*?)\/-(.*?)\/\)/);
        if (match && match[2] === "prefix") {
          currentMatchMap.set(match[1], {
            unitId: match[1],
            prefix: match[3]
          });
        }
      }
    }

    setLoading(false);

    if (currentMatchMap.size === 0) {
      setError("Không tìm thấy dữ liệu mod trong file log này. Có thể mod BARandom chưa được kích hoạt hoặc trận đấu chưa bắt đầu.");
      return;
    }

    const getPrefixWeight = (prefix: string): number => {
      const p = prefix.toLowerCase();
      const order = [
        'uncommon', 'rare', 'exceptional', 'epic', 'exotic', 'legendary', 
        'mythical', 'miracle', 'divine', 'eternal', 'supreme', 'omega', 
        'unique', 'jackpot', 'immortal', 'absurd', 'godlike', 'toorng', 
        'insanely lucky', 'dope', 'admin', 'god', 'error', 'super sayan', 
        'beyond', 'mggw', 'ambo'
      ];
      
      for (let i = order.length - 1; i >= 0; i--) {
        const keyword = order[i];
        if (keyword === 'god' && p.includes('godlike')) continue;
        if (p.includes(keyword)) return i + 1;
      }
      if (p.includes('cursed') || p.includes('malicious')) return -1;
      return 0;
    };

    // Chuyển từ Map sang Array và giữ nguyên logic sort cũ của bạn
    const latestBlock = Array.from(currentMatchMap.values()).sort((a, b) => {
      const weightA = getPrefixWeight(a.prefix);
      const weightB = getPrefixWeight(b.prefix);
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return a.unitId.localeCompare(b.unitId);
    });

    setResults(latestBlock);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleCopy = async () => {
    if (results.length === 0) return;

    const headerPrefix = `:

Uncommon

Rare

Exceptional

Epic

Exotic

Legendary

Mythical

Miracle

Divine

Eternal

Supreme

Omega

Unique

Jackpot

Immortal

Absurd

Godlike

TooRNG

Insanely Lucky

Dope

Admin

GOD

ERROR

Super Sayan

Beyond

 MGGW 

 AMBO


Beyond All Reason.

`;

    let textToCopy = headerPrefix;
    results.forEach(item => {
      const faction = getFactionInfo(item.unitId).name;
      const name = getUnitName(item.unitId);
      const desc = getUnitDescription(item.unitId);
      textToCopy += `[${faction}] ${item.unitId} (${name} - ${desc}): ${item.prefix}\n`;
    });

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const filteredResults = results.filter(item => {
    if (factionFilter === 'ALL') return true;
    return getFactionInfo(item.unitId).name === factionFilter;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-hidden flex flex-col p-4 md:p-8">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-80 h-80 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-50px] right-[-50px] w-96 h-96 bg-indigo-900/30 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl w-full mx-auto flex flex-col flex-grow z-10">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 z-10 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)]">
               <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
                </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wider text-white uppercase">BAR Randomizer Log Parser</h1>
              <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">
                Status: <span className="text-blue-400">{results.length > 0 ? "Ready to Analyze" : "Awaiting InfoLog"}</span> | Build 0.4.2
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase">Current Mod</p>
              <p className="text-sm font-bold text-slate-300">tweakdefs_rename_v2</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow overflow-hidden z-10">
          {/* Sidebar / Input */}
          <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
            <div className="bg-slate-900/60 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">Input Source</h3>
              
              <div 
                id="dropZone"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors group cursor-pointer
                  ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-950/40 hover:border-blue-500/50'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                  accept=".txt" 
                  className="hidden" 
                />
                
                <svg className={`w-12 h-12 mb-3 transition-colors ${isDragging ? 'text-blue-400' : 'text-slate-600 group-hover:text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>

                <span className="text-sm font-medium">Drop <span className="text-blue-400">infolog.txt</span></span>
                <span className="text-[10px] text-slate-500 mt-1 uppercase">Max size 10MB</span>
              </div>
              
              <AnimatePresence>
                {loading && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 flex items-center justify-center gap-2"
                  >
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">Parsing Log...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-indigo-900/20 border border-indigo-500/30 p-5 rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-3">Instructions</h3>
              <ul className="text-xs text-indigo-100/70 space-y-2">
                <li className="flex gap-2"><span>•</span> <span className="text-indigo-200">Locate your game folder.</span></li>
                <li className="flex gap-2"><span>•</span> <span className="text-indigo-200">Find infolog.txt after a match.</span></li>
                <li className="flex gap-2"><span>•</span> <span className="text-indigo-200">Drag file here to view unit mods.</span></li>
              </ul>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl flex items-start gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Error</h4>
                    <p className="text-[10px] text-red-300/80 leading-relaxed">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-auto hidden lg:block">
              <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-500">System Check</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                  <span className="text-[10px] font-bold text-emerald-500">SYNCED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="col-span-1 lg:col-span-8 flex flex-col bg-slate-900/60 border border-white/10 rounded-3xl backdrop-blur-lg overflow-hidden min-h-[400px]">
            {results.length > 0 ? (
              <>
                {/* Table Toolbar */}
                <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="px-3 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-full">{filteredResults.length} UNITS</div>
                    <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
                    {['ALL', 'Armada', 'Cortex', 'Legion', 'Scavenger', 'Events', 'Other'].map(faction => (
                      <button
                        key={faction}
                        onClick={() => setFactionFilter(faction as any)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-full transition-colors uppercase tracking-widest ${
                          factionFilter === faction 
                            ? 'bg-indigo-500 text-white' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-white/5'
                        }`}
                      >
                        {faction}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={handleCopy}
                    className="text-[10px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-slate-200"
                  >
                    {copyStatus === 'copied' ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : copyStatus === 'error' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copyStatus === 'copied' ? 'COPIED!' : 'Copy Data'}
                  </button>
                </div>

                {/* Scrollable Container */}
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-slate-900 text-[11px] text-slate-500 uppercase tracking-wider z-10">
                      <tr>
                        <th className="text-left px-6 py-4 font-semibold border-b border-white/10">#</th>
                        <th className="text-left px-4 py-4 font-semibold border-b border-white/10">Faction</th>
                        <th className="text-left px-4 py-4 font-semibold border-b border-white/10">Unit</th>
                        <th className="text-left px-6 py-4 font-semibold border-b border-white/10">Modification Prefix</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredResults.map((item, index) => {
                        const faction = getFactionInfo(item.unitId);
                        return (
                          <tr key={index} className={`border-b border-white/5 ${index % 2 === 0 ? 'bg-white/5' : ''}`}>
                            <td className="px-6 py-4 text-slate-500">{String(index + 1).padStart(2, '0')}</td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-0.5 rounded ${faction.bg} border ${faction.border} text-[10px] font-bold ${faction.color} uppercase`}>
                                {faction.name}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-5">
                                {getUnitImage(item.unitId) ? (
                                  <img 
                                    src={getUnitImage(item.unitId)!} 
                                    alt={getUnitName(item.unitId)} 
                                    className="w-20 h-20 sm:w-24 sm:h-24 rounded object-cover bg-slate-800/80 border border-white/10 shadow-lg" 
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded bg-slate-800/80 border border-white/5 flex items-center justify-center shadow-lg">
                                    <Gamepad2 className="w-8 h-8 text-slate-600" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className="text-base font-bold text-slate-200 leading-tight">{getUnitName(item.unitId)}</div>
                                  <div className="font-mono text-xs text-cyan-400 mt-1 leading-tight">{item.unitId}</div>
                                  <div className="text-xs text-slate-500 mt-1 leading-tight max-w-sm">{getUnitDescription(item.unitId)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={getPrefixColorClass(item.prefix)}>{item.prefix}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Status Bar */}
                <div className="p-4 bg-slate-950/60 text-[10px] text-slate-500 flex justify-between items-center font-mono">
                  <span>DATA PARSED SECURELY</span>
                  <span className="flex items-center gap-2">
                    <span className="text-blue-400">SCANNING:</span> [DONE] SECTOR 7G-8812
                  </span>
                </div>
              </>
            ) : (
              <div className="flex-grow flex items-center justify-center flex-col text-slate-500 p-8 text-center">
                <div className="border-2 border-dashed border-slate-700/50 rounded-xl p-10 flex flex-col items-center max-w-sm">
                  <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Awaiting infolog.txt</h3>
                  <p className="text-xs text-slate-500">Upload a file from your game directory to view the unit modifier list.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
