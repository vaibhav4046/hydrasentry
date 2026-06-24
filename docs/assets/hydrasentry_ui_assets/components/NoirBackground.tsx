export function NoirBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050608]">
      <div className="absolute inset-0 opacity-70" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)',
        backgroundSize: '64px 64px'
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at 58% 38%, rgba(255,255,255,.16), rgba(255,255,255,.04) 32%, transparent 58%)'
      }} />
      <div className="absolute left-1/2 top-1/2 h-[720px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full opacity-45" viewBox="0 0 1400 900" fill="none">
        <path d="M790 690C760 560 760 440 800 320C842 196 942 126 1070 72" stroke="white" strokeOpacity=".28" />
        <path d="M800 320C650 282 520 205 390 92" stroke="white" strokeOpacity=".18" />
        <path d="M805 350C960 338 1090 292 1235 178" stroke="white" strokeOpacity=".16" />
        <path d="M780 510C620 540 480 610 340 765" stroke="white" strokeOpacity=".13" />
        {[ [800,320], [1070,72], [390,92], [1235,178], [340,765], [790,690] ].map(([cx,cy],i)=>(
          <circle key={i} cx={cx} cy={cy} r={i===0?5:3} fill="white" fillOpacity={i===0?'.9':'.65'} />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050608] to-transparent" />
    </div>
  );
}
