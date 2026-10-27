type P = { className?: string };
const base = (className = "h-5 w-5") => ({ className, viewBox: "0 0 24 24", "aria-hidden": true as const });

export const PlayIcon = ({ className }: P) => (<svg {...base(className)} fill="currentColor"><path d="M6 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5z" /></svg>);
export const PlusIcon = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>);
export const CheckIcon = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const ThumbIcon = ({ className, filled }: P & { filled?: boolean }) => (<svg {...base(className)} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M7 21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3zm0 0h10.3a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 18.7 10H14V5.5A2.5 2.5 0 0 0 11.5 3L7 11" /></svg>);
export const ChevronDown = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>);
export const ChevronLeft = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>);
export const ChevronRight = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>);
export const InfoIcon = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6M12 7.5v.01" strokeLinecap="round" /></svg>);
export const SearchIcon = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></svg>);
export const BellIcon = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4zM10 21h4" /></svg>);
export const CloseIcon = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const VolumeIcon = ({ className }: P) => (<svg {...base(className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" strokeLinecap="round" /></svg>);
