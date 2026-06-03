import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as AllIcons from "@/components/ui/icons";
import {
  Palette,
  Type,
  Component,
  Clock,
  ArrowLeft,
  Plus,
  Loader2,
  Upload,
  Download,
  Play,
  Eye,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";

export default function DesignSystemPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Colors");

  const coreColors = [
    { name: "Background", var: "--background", class: "bg-background" },
    { name: "Foreground", var: "--foreground", class: "bg-foreground" },
    { name: "Primary", var: "--primary", class: "bg-primary" },
    { name: "Secondary", var: "--secondary", class: "bg-secondary" },
    { name: "Muted", var: "--muted", class: "bg-muted" },
    { name: "Accent", var: "--accent", class: "bg-accent" },
  ];

  const semanticColors = [
    { name: "Card", var: "--card", class: "bg-card" },
    { name: "Popover", var: "--popover", class: "bg-popover" },
    { name: "Border", var: "--border", class: "bg-border" },
    { name: "Input", var: "--input", class: "bg-input" },
    { name: "Ring", var: "--ring", class: "bg-ring" },
    { name: "Destructive", var: "--destructive", class: "bg-destructive" },
  ];

  const timelineColors = [
    { name: "Timeline BG", var: "--timeline-bg", class: "bg-timeline-bg" },
    {
      name: "Track BG",
      var: "--timeline-track-bg",
      class: "bg-timeline-track-bg",
    },
    {
      name: "Video Clip",
      var: "--timeline-clip-video",
      class: "bg-timeline-clip-video",
    },
    {
      name: "Audio Clip",
      var: "--timeline-clip-audio",
      class: "bg-timeline-clip-audio",
    },
    {
      name: "Selected Clip",
      var: "--timeline-clip-selected",
      class: "bg-timeline-clip-selected",
    },
    { name: "Playhead", var: "--playhead", class: "bg-playhead" },
  ];

  const chartColors = [
    { name: "Chart 1", var: "--chart-1", class: "bg-chart-1" },
    { name: "Chart 2", var: "--chart-2", class: "bg-chart-2" },
    { name: "Chart 3", var: "--chart-3", class: "bg-chart-3" },
    { name: "Chart 4", var: "--chart-4", class: "bg-chart-4" },
    { name: "Chart 5", var: "--chart-5", class: "bg-chart-5" },
  ];

  const typeScale = [
    {
      name: "text-headline-1",
      class: "text-headline-1 font-bold",
      text: "CloudCut Editor",
    },
    {
      name: "text-headline-2",
      class: "text-headline-2 font-bold",
      text: "Project Dashboard",
    },
    {
      name: "text-headline-3",
      class: "text-headline-3 font-bold",
      text: "Timeline Controls",
    },
    {
      name: "text-headline-4",
      class: "text-headline-4 font-bold",
      text: "Asset Browser",
    },
    {
      name: "text-headline-5",
      class: "text-headline-5 font-semibold",
      text: "Inspector Panel",
    },
    {
      name: "text-body-1",
      class: "text-body-1",
      text: "Default body text for descriptions and content",
    },
    {
      name: "text-body-2",
      class: "text-body-2",
      text: "Secondary text and labels",
    },
    {
      name: "text-body-3",
      class: "text-body-3",
      text: "Captions, timestamps, and metadata",
    },
  ];

  const fontWeights = [
    { name: "font-normal", class: "font-normal", text: "Regular 400" },
    { name: "font-medium", class: "font-medium", text: "Medium 500" },
    { name: "font-semibold", class: "font-semibold", text: "Semibold 600" },
    { name: "font-bold", class: "font-bold", text: "Bold 700" },
  ];

  const tabs = [
    { id: "Colors", icon: Palette },
    { id: "Typography", icon: Type },
    { id: "Components", icon: Component },
  ];

  return (
    <div className="bg-background text-foreground mx-auto min-h-screen max-w-5xl p-8 font-sans">
      <header className="mb-8 flex items-center justify-between pb-6">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-foreground/70 hover:text-foreground flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Editor
          </Button>
          <div className="flex items-center gap-2 font-semibold">
            CloudCut Design System
          </div>
        </div>
        <div className="bg-muted border-border text-foreground/70 rounded border px-2 py-1 font-mono text-xs">
          v1.0.0
        </div>
      </header>

      <div className="mb-8">
        <h1 className="mb-4 text-4xl font-bold">Design System</h1>
        <p className="text-foreground/70 max-w-2xl text-lg leading-relaxed">
          A comprehensive design system for CloudCut, the collaborative video
          editor. This guide covers colors, typography, spacing, and components
          used throughout the application.
        </p>
      </div>

      <div className="bg-card border-border mb-8 flex w-fit items-center gap-1 rounded-lg border p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4" /> {tab.id}
            </button>
          );
        })}
      </div>

      {activeTab === "Colors" && (
        <div className="animate-in fade-in space-y-8 duration-300">
          <ColorSection
            title="Core Colors"
            description="Primary color palette used throughout the application"
            colors={coreColors}
          />
          <ColorSection
            title="Semantic Colors"
            description="Colors for cards, popovers, and interactive elements"
            colors={semanticColors}
          />
          <ColorSection
            title="Timeline Colors"
            description="Specialized colors for the video timeline interface"
            colors={timelineColors}
          />
          <ColorSection
            title="Chart Colors"
            description="Color palette for data visualizations and charts"
            colors={chartColors}
          />
        </div>
      )}

      {activeTab === "Typography" && (
        <div className="animate-in fade-in space-y-8 duration-300">
          <div className="border-border bg-card rounded-xl border p-6">
            <h3 className="mb-1 text-lg font-semibold">Font Families</h3>
            <p className="text-foreground/60 mb-6 text-sm">
              Primary and monospace fonts used in the design system
            </p>

            <div className="space-y-4">
              <div className="border-border bg-background rounded-lg border p-6">
                <div className="text-foreground/50 mb-3 font-mono text-xs">
                  font-sans (Geist Variable)
                </div>
                <div className="font-sans text-2xl">
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>

              <div className="border-border bg-background rounded-lg border p-6">
                <div className="text-foreground/50 mb-3 font-mono text-xs">
                  font-mono (JetBrains Mono)
                </div>
                <div className="font-mono text-2xl">
                  00:01:23.45 → const timeline = []
                </div>
              </div>
            </div>
          </div>

          <div className="border-border bg-card rounded-xl border p-6">
            <h3 className="mb-1 text-lg font-semibold">Type Scale</h3>
            <p className="text-foreground/60 mb-8 text-sm">
              Typography hierarchy for headings and body text
            </p>

            <div className="divide-border space-y-8 divide-y">
              {typeScale.map((type) => (
                <div
                  key={type.name}
                  className="grid grid-cols-[150px_1fr] items-center pt-8 first:pt-0 md:grid-cols-[200px_1fr]"
                >
                  <div className="text-foreground/50 font-mono text-xs">
                    {type.name}
                  </div>
                  <div className={`${type.class} truncate`}>{type.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-border bg-card rounded-xl border p-6">
            <h3 className="mb-1 text-lg font-semibold">Font Weights</h3>
            <p className="text-foreground/60 mb-8 text-sm">
              Available font weights for text styling
            </p>

            <div className="divide-border space-y-6 divide-y">
              {fontWeights.map((weight) => (
                <div
                  key={weight.name}
                  className="grid grid-cols-[150px_1fr] items-center pt-6 first:pt-0 md:grid-cols-[200px_1fr]"
                >
                  <div className="text-foreground/50 font-mono text-xs">
                    {weight.name}
                  </div>
                  <div className={`${weight.class} text-xl`}>{weight.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Components" && (
        <TooltipProvider>
          <div className="animate-in fade-in space-y-8 duration-300">
            {/* Buttons */}
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="mb-1 text-lg font-semibold">Buttons</h3>
              <p className="text-foreground/60 mb-6 text-sm">
                Button variants for different actions and contexts
              </p>

              <div className="mb-6 flex flex-wrap items-center gap-4">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Add">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Button disabled>Disabled</Button>
                <Button disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading
                </Button>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
                <Button>
                  Export
                  <Download className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Form Elements */}
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="mb-1 text-lg font-semibold">Form Elements</h3>
              <p className="text-foreground/60 mb-6 text-sm">
                Input fields, selects, and other form controls
              </p>

              <div className="mb-6 grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Input</Label>
                  <Input placeholder="Enter text..." />
                </div>
                <div className="space-y-2">
                  <Label>Disabled Input</Label>
                  <Input placeholder="Disabled" disabled />
                </div>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Select</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Option 1</SelectItem>
                      <SelectItem value="2">Option 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 pt-2">
                  <Label className="mb-2 block">Slider (50%)</Label>
                  <Slider defaultValue={[50]} max={100} step={1} />
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="flex items-center space-x-2">
                  <Switch id="feature" />
                  <Label htmlFor="feature">Enable feature</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="terms" />
                  <Label htmlFor="terms">Accept terms</Label>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="mb-1 text-lg font-semibold">Badges</h3>
              <p className="text-foreground/60 mb-6 text-sm">
                Status indicators and labels
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge className="border-transparent bg-[#0083FF] text-white hover:bg-[#0083FF]/80">
                  Video
                </Badge>
                <Badge className="border-transparent bg-[#008E3E] text-white hover:bg-[#008E3E]/80">
                  Audio
                </Badge>
                <Badge className="border-transparent bg-[#FF6B3F] text-white hover:bg-[#FF6B3F]/80">
                  Live
                </Badge>
              </div>
            </div>

            {/* Avatars */}
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="mb-1 text-lg font-semibold">Avatars</h3>
              <p className="text-foreground/60 mb-6 text-sm">
                User avatars for collaborator displays
              </p>

              <div className="flex items-center gap-4">
                <Avatar className="border-border h-10 w-10 border">
                  <AvatarFallback className="bg-primary text-white">
                    AC
                  </AvatarFallback>
                </Avatar>
                <Avatar className="border-border h-10 w-10 border">
                  <AvatarFallback className="bg-chart-2 text-white">
                    BK
                  </AvatarFallback>
                </Avatar>
                <Avatar className="border-primary h-12 w-12 border-2">
                  <AvatarFallback className="bg-chart-3 text-white">
                    ME
                  </AvatarFallback>
                </Avatar>

                {/* Avatar group */}
                <div className="ml-4 flex -space-x-3">
                  <Avatar className="border-background h-8 w-8 border-2">
                    <AvatarFallback className="bg-primary text-xs text-white">
                      A
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="border-background h-8 w-8 border-2">
                    <AvatarFallback className="bg-chart-2 text-xs text-white">
                      B
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="border-background h-8 w-8 border-2">
                    <AvatarFallback className="bg-chart-3 text-xs text-white">
                      C
                    </AvatarFallback>
                  </Avatar>
                  <div className="border-background bg-muted text-muted-foreground z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px]">
                    +3
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Indicators */}
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="mb-1 text-lg font-semibold">
                Progress Indicators
              </h3>
              <p className="text-foreground/60 mb-6 text-sm">
                Loading and progress states
              </p>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground/70">
                      Exporting video...
                    </span>
                    <span className="font-mono">67%</span>
                  </div>
                  <Progress value={67} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground/70">Uploading assets</span>
                    <span className="font-mono">100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
              </div>
            </div>

            {/* Tooltips */}
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="mb-1 text-lg font-semibold">Tooltips</h3>
              <p className="text-foreground/60 mb-6 text-sm">
                Contextual information on hover
              </p>

              <div className="flex gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Play className="h-4 w-4 opacity-70" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Play video</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Eye className="h-4 w-4 opacity-70" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Preview</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Download className="h-4 w-4 opacity-70" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Icons */}
            <div className="border-border bg-card rounded-xl border p-6">
              <h3 className="mb-1 text-lg font-semibold">Icons</h3>
              <p className="text-foreground/60 mb-6 text-sm">
                System icons used across the application
              </p>

              <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8">
                {Object.entries(AllIcons).map(([name, Icon]) => (
                  <div
                    key={name}
                    className="border-border bg-background hover:bg-muted group flex flex-col items-center justify-center gap-3 rounded-lg border p-4 transition-colors"
                  >
                    <Icon className="text-foreground/80 group-hover:text-foreground h-6 w-6 transition-colors" />
                    <span className="text-foreground/50 w-full truncate text-center font-mono text-[10px]">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TooltipProvider>
      )}

      {activeTab === "Timeline" && (
        <div className="border-border bg-card text-foreground/50 animate-in fade-in rounded-xl border border-dashed p-12 text-center duration-300">
          {activeTab} implementation pending...
        </div>
      )}

      <footer className="border-border text-foreground/40 mt-20 border-t pt-8 pb-8 text-center text-xs">
        CloudCut Design System
      </footer>
    </div>
  );
}

function ColorSection({
  title,
  description,
  colors,
}: {
  title: string;
  description: string;
  colors: { name: string; var: string; class: string }[];
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-6">
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="text-foreground/60 mb-6 text-sm">{description}</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {colors.map((color) => (
          <div key={color.name}>
            <div
              className={`border-border/50 mb-3 h-16 rounded-md border ${color.class}`}
            ></div>
            <div className="text-sm font-medium">{color.name}</div>
            <div className="text-foreground/50 mt-1 font-mono text-xs">
              {color.var}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
