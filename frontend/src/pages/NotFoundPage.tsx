import { useNavigate } from "react-router-dom";
import { Film, ArrowLeft, Home, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-background text-foreground relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden p-4 font-sans select-none md:p-6">
      {/* Interactive Grid Backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] bg-[size:4rem_4rem] opacity-30" />

      {/* Ambient Glows */}
      <div
        className="bg-primary/10 pointer-events-none absolute top-1/4 left-1/3 h-[300px] w-[300px] animate-pulse rounded-full blur-[100px]"
        style={{ animationDuration: "6s" }}
      />
      <div
        className="bg-destructive/5 pointer-events-none absolute right-1/3 bottom-1/4 h-[300px] w-[300px] animate-pulse rounded-full blur-[120px]"
        style={{ animationDuration: "8s" }}
      />

      {/* Main Glassmorphic Window Container */}
      <div className="bg-card/60 border-border hover:border-border/80 relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300">
        {/* Mock Editor Window Header */}
        <div className="border-border bg-muted/30 flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="bg-destructive/60 h-2.5 w-2.5 rounded-full" />
            <span className="bg-chart-5/60 h-2.5 w-2.5 rounded-full" />
            <span className="bg-chart-2/60 h-2.5 w-2.5 rounded-full" />
          </div>
          <div className="text-foreground/50 flex max-w-[200px] items-center gap-1.5 truncate font-mono text-xs md:max-w-none">
            <Film className="text-primary h-3.5 w-3.5" />
            <span>Source: 404_Sequence_Offline.mp4</span>
          </div>
          <div className="bg-destructive/10 text-destructive border-destructive/20 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider">
            OFFLINE
          </div>
        </div>

        {/* Source Monitor Preview Window */}
        <div className="border-border group relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden border-b bg-[#070707]">
          {/* SMPTE-Style Color Bars Background */}
          <div className="pointer-events-none absolute inset-0 flex opacity-15">
            <div className="h-full w-[14.28%] bg-white" />
            <div className="h-full w-[14.28%] bg-yellow-400" />
            <div className="h-full w-[14.28%] bg-cyan-400" />
            <div className="h-full w-[14.28%] bg-green-500" />
            <div className="bg-magenta-500 h-full w-[14.28%]" />
            <div className="h-full w-[14.28%] bg-red-600" />
            <div className="h-full w-[14.28%] bg-blue-600" />
          </div>

          {/* Glitch TV Grid Overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
              backgroundSize: "100% 4px, 6px 100%",
            }}
          />

          {/* Safe Area Markers */}
          <div className="border-foreground/10 pointer-events-none absolute inset-3 rounded border border-dashed" />
          <div className="border-foreground/5 pointer-events-none absolute inset-6 rounded border border-dashed" />

          {/* Recording Badge */}
          <div className="text-destructive/80 absolute top-4 right-4 flex items-center gap-1.5 rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold backdrop-blur-xs select-none">
            <span className="bg-destructive h-2 w-2 animate-ping rounded-full" />
            <span>REC</span>
          </div>

          {/* Timecode Overlay */}
          <div className="text-foreground/60 border-border/50 absolute right-4 bottom-4 rounded border bg-black/50 px-2 py-0.5 font-mono text-xs">
            00:04:04:00
          </div>

          {/* Play Status Overlay */}
          <div className="text-foreground/40 absolute bottom-4 left-4 rounded bg-black/30 px-2 py-0.5 font-mono text-[10px]">
            ⏸ PAUSE
          </div>

          {/* Core Media Offline Alert */}
          <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-destructive border-destructive-foreground/20 rotate-[-3deg] animate-pulse border px-4 py-1.5 font-mono text-xs font-semibold tracking-[0.2em] text-white uppercase shadow-xl select-none md:text-sm">
              Media Offline
            </div>
            <div className="text-foreground/40 mt-4 font-mono text-[10px] tracking-wider">
              ERROR 404: CLIP_NOT_RESOLVED
            </div>
          </div>
        </div>

        {/* Mock Timeline Controls */}
        <div className="border-border bg-muted/10 space-y-4 border-b p-4 md:p-6">
          <div className="flex items-center justify-between">
            <span className="text-foreground/40 font-mono text-[11px] font-medium tracking-wider uppercase">
              Active Sequence Timeline
            </span>
            <span className="text-primary font-mono text-[11px] font-semibold">
              404_Not_Found_Sequence
            </span>
          </div>

          {/* Timeline Tracks */}
          <div className="border-border space-y-2 rounded-lg border bg-black/40 p-2.5 select-none">
            {/* Video Track (V1) */}
            <div className="flex items-center gap-2">
              <span className="text-foreground/30 w-5 text-right text-[10px] font-bold">
                V1
              </span>
              <div className="relative grid h-5 flex-1 grid-cols-12 gap-1">
                {/* Moving Playhead */}
                <div
                  className="bg-playhead pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 animate-[playhead_6s_linear_infinite]"
                  style={{
                    boxShadow: "0 0 8px var(--playhead)",
                  }}
                />

                <div className="bg-timeline-clip-video/50 border-timeline-clip-selected col-span-3 flex items-center truncate rounded border-l px-1.5 text-white/80">
                  intro.mp4
                </div>
                <div className="bg-destructive/20 border-destructive/40 text-destructive col-span-5 flex animate-pulse items-center justify-center gap-1 truncate rounded border border-dashed px-1.5">
                  <span>⚠️</span>
                  <span className="font-bold">missing_clip</span>
                </div>
                <div className="bg-timeline-clip-video/30 border-timeline-clip-selected/50 col-span-4 flex items-center truncate rounded border-l px-1.5">
                  outro.mp4
                </div>
              </div>
            </div>

            {/* Audio Track (A1) */}
            <div className="flex items-center gap-2">
              <span className="text-foreground/30 w-5 text-right text-[10px] font-bold">
                A1
              </span>
              <div className="relative grid h-5 flex-1 grid-cols-12 gap-1">
                {/* Moving Playhead */}
                <div
                  className="bg-playhead pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 animate-[playhead_6s_linear_infinite]"
                  style={{
                    boxShadow: "0 0 8px var(--playhead)",
                  }}
                />

                <div className="bg-timeline-clip-audio/50 col-span-4 flex items-center truncate rounded border-l border-green-500 px-1.5 text-white/80">
                  bgm_track.wav
                </div>
                <div className="border-border/40 text-foreground/20 col-span-4 flex items-center justify-center rounded border border-dashed italic">
                  mute
                </div>
                <div className="bg-timeline-clip-audio/30 col-span-4 flex items-center truncate rounded border-l border-green-500/50 px-1.5">
                  sfx_cut.wav
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content and Message */}
        <div className="space-y-4 p-6 text-center md:p-8">
          <h1 className="from-foreground via-foreground to-foreground/75 bg-gradient-to-r bg-clip-text text-xl font-bold tracking-tight text-transparent md:text-2xl">
            Sequence Break: Page Not Found
          </h1>
          <p className="text-foreground/60 mx-auto max-w-sm text-sm leading-relaxed">
            The page you are looking for has been cut from the final timeline or
            never existed. Let's redirect you back to active tracks.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            <Button
              onClick={() => navigate("/")}
              className="bg-primary hover:bg-primary/80 shadow-primary/20 w-full font-medium text-white shadow-lg sm:w-auto"
              size="lg"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </Button>
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="border-border hover:bg-muted/50 text-foreground w-full bg-transparent sm:w-auto"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous Frame
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-foreground/30 relative z-10 mt-8 flex items-center gap-2 font-mono text-xs">
        <HelpCircle className="h-3.5 w-3.5" />
        <span>Need help? Check out the</span>
        <a
          href="/design-system"
          className="text-primary font-medium transition-colors hover:underline"
        >
          Design System
        </a>
      </div>

      {/* Embedded style tag for keyframe animations */}
      <style>{`
        @keyframes playhead {
          0% { left: 0%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
