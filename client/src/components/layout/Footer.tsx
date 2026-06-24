export function Footer() {
  return (
    <footer
      className="border-t border-[#1E2D3D] mt-auto"
      style={{ background: "#010A13" }}
    >
      <div
        className="h-px w-full"
        style={{ background: "linear-gradient(90deg,transparent,#785A28 30%,#C89B3C 50%,#785A28 70%,transparent)" }}
      />
      <div className="max-w-screen-xl mx-auto px-4 py-6 flex flex-col items-center gap-2 text-center">
        <div className="font-['Cinzel'] font-bold text-lg tracking-widest">
          <span className="gold-text">SOUL</span>
          <span className="text-[#A0B4C8]">POINT</span>
        </div>
        <p className="text-[10px] text-[#3a4a5a] max-w-xl leading-relaxed">
          Soul Point isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
          officially involved in producing or managing League of Legends. League of Legends and Riot Games are
          trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.
        </p>
        <p className="text-[9px] text-[#2a3a4a]">
          © {new Date().getFullYear()} Soul Point · Fan-made analytics tool · Not affiliated with Riot Games
        </p>
      </div>
    </footer>
  );
}
