import React from 'react';
import svgPaths from "../imports/svg-58dytggail";
import { motion } from "motion/react";

// Reusing the Eodin Logo components but adapted for this page
function EodinLogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
       <path d={svgPaths.p30d97fd0} fill="white" stroke="#FFC095" strokeWidth="0.711111" />
       <path d={svgPaths.pabd2680} fill="#FC8D42" />
       <path d={svgPaths.p14935300} fill="#363739" />
       <path d={svgPaths.p1def4e00} fill="#FAA668" />
    </svg>
  );
}

function EodinTextLogoFormatted({ color = "#363739" }: { color?: string }) {
    return (
        <div className="flex items-end h-[30px] gap-1 select-none">
            {/* E */}
            <svg width="18" height="21" viewBox="0 0 18 21" fill="none"><path d={svgPaths.p27770a0} fill={color} /></svg>
            {/* o */}
            <svg width="20" height="21" viewBox="0 0 20 21" fill="none"><path d={svgPaths.pb8b9900} fill={color} /></svg>
            {/* d */}
            <svg width="19" height="30" viewBox="0 0 19 30" fill="none"><path d={svgPaths.p93b6a00} fill={color} /></svg>
            {/* i */}
            <svg width="7" height="30" viewBox="0 0 7 30" fill="none"><path d={svgPaths.p1a7be400} fill={color} /></svg>
            {/* n */}
            <svg width="19" height="28" viewBox="0 0 19 28" fill="none"><path d={svgPaths.p104cf00} fill={color} /></svg>
        </div>
    );
}

function AppIcon() {
    return (
        <div className="w-24 h-24 rounded-[22px] bg-gradient-to-br from-white to-[#FFF0E0] shadow-xl border border-white/50 flex items-center justify-center relative overflow-hidden group transition-transform hover:scale-105 duration-300">
             <div className="absolute inset-0 bg-gradient-to-br from-[#fc8d42]/10 to-transparent pointer-events-none" />
             <EodinLogoMark className="w-14 h-14 drop-shadow-lg" />
        </div>
    );
}

export default function DeepLinkPage() {
  const deepLink = "eodin://app/home"; // Fictional deep link
  const storeLink = "#";

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-white relative overflow-hidden font-sans text-[#363739] selection:bg-[#fc8d42] selection:text-white">
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center gap-8 max-w-sm md:max-w-md w-full"
        >


            <div className="w-full flex flex-col items-center text-center">
                
                {/* App Icon */}
                <div className="mb-6 relative">
                     <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                     >
                        <AppIcon />
                     </motion.div>
                     {/* Status Indicator */}
                     <div className="absolute -bottom-1 -right-1 bg-[#10B981] border-[3px] border-white w-6 h-6 rounded-full shadow-sm" title="Service Active" />
                </div>

                {/* Text Content */}
                <h1 className="text-2xl md:text-3xl font-bold text-[#363739] mb-3 tracking-tight">
                    Eodin Intelligence
                </h1>
                <p className="text-[#363739]/70 text-sm md:text-base mb-8 leading-relaxed max-w-[280px]">
                    The wisdom beyond intelligence.
                    <br/>
                    <span className="opacity-80 text-xs">Opening in Eodin App...</span>
                </p>

                {/* PC View: QR Code */}
                <div className="hidden md:flex flex-col items-center w-full animate-in fade-in duration-700">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-5 relative group overflow-hidden">
                         <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(deepLink)}&color=363739&bgcolor=ffffff&margin=0`}
                            alt="Scan to open"
                            className="w-40 h-40 object-contain opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
                         />
                         <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-[2px] rounded-xl pointer-events-none">
                            <div className="bg-[#fc8d42] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                Scan to Open
                            </div>
                         </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#363739]/50 font-semibold uppercase tracking-wider">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Scan with your phone
                    </div>
                </div>

                {/* Mobile View: Action Buttons */}
                <div className="flex md:hidden flex-col w-full gap-3 animate-in slide-in-from-bottom-4 duration-700">
                    <a 
                        href={deepLink}
                        className="w-full bg-gradient-to-r from-[#fc8d42] to-[#ffa569] hover:from-[#e57a35] hover:to-[#fc8d42] active:scale-[0.98] transition-all text-white font-semibold py-4 px-6 rounded-xl shadow-[0_8px_20px_-6px_rgba(252,141,66,0.4)] flex items-center justify-center gap-2"
                    >
                        Open App
                    </a>
                    <a 
                        href={storeLink}
                        className="w-full bg-white hover:bg-gray-50 text-[#363739]/70 font-medium py-4 px-6 rounded-xl border border-gray-200/80 flex items-center justify-center gap-2 text-sm"
                    >
                        Don't have the app? Download
                    </a>
                </div>

            </div>


        </motion.div>
      </div>
    </div>
  );
}