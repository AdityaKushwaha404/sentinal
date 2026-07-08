"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Loader2, Globe, Shield, Activity, Cpu, ArrowRight, ArrowLeft, Check, Plus, X, HelpCircle
} from "lucide-react";
import { useCreateMonitor } from "@/hooks/use-monitors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const MONITOR_TYPES = [
  { id: "HTTP", name: "HTTP", desc: "Basic web server probe", icon: Globe, color: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
  { id: "HTTPS", name: "HTTPS", desc: "Secure HTTP probe", icon: Shield, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  { id: "TCP", name: "TCP Port Check", desc: "Monitor raw TCP connection", icon: Activity, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
  { id: "SSL", name: "SSL Only", desc: "Check SSL certificate expiration", icon: Shield, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  { id: "PING", name: "Ping (TCP)", desc: "Simulated ICMP ping via TCP", icon: Cpu, color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
  { id: "JSON_API", name: "JSON API", desc: "Probe API and assert JSON keys", icon: Globe, color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
] as const;

const monitorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().min(1, "Target host or URL is required"),
  type: z.enum(["HTTP", "HTTPS", "TCP", "SSL", "PING", "JSON_API"]),
  monitorInterval: z.number().int().min(1),
  tagsInput: z.string().optional(),
  // Advanced fields
  httpMethod: z.enum(["GET", "POST", "PUT", "HEAD", "OPTIONS"]).optional(),
  timeoutMs: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().int().min(1000).max(30000).optional()
  ) as any,
  expectedStatusCode: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().int().min(100).max(599).optional()
  ) as any,
  jsonPath: z.string().optional(),
  jsonPathExpected: z.string().optional(),
  tcpPort: z.preprocess(
    (val) => (val === "" || val === null || val === undefined || isNaN(Number(val)) ? undefined : Number(val)),
    z.number().int().min(1).max(65535).optional()
  ) as any,
});

type FormValues = z.infer<typeof monitorSchema>;

interface MonitorWizardProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MonitorWizard({ isOpen, onOpenChange }: MonitorWizardProps) {
  const [step, setStep] = useState(1);
  const createMonitor = useCreateMonitor();

  const form = useForm<FormValues>({
    resolver: zodResolver(monitorSchema),
    defaultValues: {
      name: "",
      url: "",
      type: "HTTP",
      monitorInterval: 5,
      tagsInput: "",
      httpMethod: "GET",
      timeoutMs: 8000,
    },
  });

  const watchType = form.watch("type");

  const handleTypeSelect = (typeId: FormValues["type"]) => {
    form.setValue("type", typeId);
    // Autofill defaults based on type
    if (typeId === "TCP" && !form.getValues("tcpPort")) {
      form.setValue("tcpPort", 80);
    }
    if (typeId === "PING" && !form.getValues("tcpPort")) {
      form.setValue("tcpPort", 80);
    }
    if (typeId === "JSON_API" && !form.getValues("expectedStatusCode")) {
      form.setValue("expectedStatusCode", 200);
    }
    setStep(2);
  };

  const handleNext = async () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    let fieldsToValidate: (keyof FormValues)[] = [];
    if (step === 2) {
      fieldsToValidate = ["url", "name"];
      if (watchType === "TCP" || watchType === "PING") {
        fieldsToValidate.push("tcpPort");
      }
    } else if (step === 3) {
      fieldsToValidate = ["monitorInterval", "timeoutMs"];
      if (watchType === "JSON_API") {
        fieldsToValidate.push("expectedStatusCode", "jsonPath", "jsonPathExpected");
      }
    }

    console.log("Validating fields:", fieldsToValidate);
    const isValid = await form.trigger(fieldsToValidate);
    console.log("Validation result:", isValid, "Form errors:", form.formState.errors);
    if (isValid) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const onSubmit = (values: FormValues) => {
    console.log("Submitting monitor values:", values);
    const tags = values.tagsInput 
      ? values.tagsInput.split(",").map(t => t.trim()).filter(Boolean) 
      : [];

    // Filter NaN values from optional number fields (HTML inputs yield NaN if empty)
    const expectedStatusCode = values.expectedStatusCode && !isNaN(values.expectedStatusCode)
      ? values.expectedStatusCode
      : undefined;

    const tcpPort = values.tcpPort && !isNaN(values.tcpPort)
      ? values.tcpPort
      : undefined;

    const timeoutMs = values.timeoutMs && !isNaN(values.timeoutMs)
      ? values.timeoutMs
      : undefined;

    createMonitor.mutate(
      {
        name: values.name,
        url: values.url,
        type: values.type,
        monitorInterval: values.monitorInterval,
        tags,
        httpMethod: values.httpMethod,
        timeoutMs,
        expectedStatusCode,
        jsonPath: values.jsonPath || undefined,
        jsonPathExpected: values.jsonPathExpected || undefined,
        tcpPort,
      },
      {
        onSuccess: () => {
          console.log("Monitor created successfully!");
          onOpenChange(false);
          setStep(1);
          form.reset();
        },
        onError: (err) => {
          console.error("Mutation failed to create monitor:", err);
        }
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setStep(1);
        form.reset();
      }
    }}>
      <DialogContent className="bg-card/95 border border-border/80 text-card-foreground rounded-2xl p-6 max-w-lg w-full shadow-2xl backdrop-blur-md">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-sm font-bold tracking-tight text-foreground flex items-center justify-between uppercase">
            <span>Add Monitor Wizard</span>
            <div className="flex items-center gap-1.5 bg-muted px-2.5 py-0.5 rounded-full border border-border text-[9px] font-extrabold font-mono text-muted-foreground">
              Step {step} of 4
            </div>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs font-medium">
            {step === 1 && "Select the check type that suits your infrastructure component."}
            {step === 2 && "Enter target host/URL and give this probe a friendly name."}
            {step === 3 && "Tune interval, timeout, and configure advanced assertions."}
            {step === 4 && "Review your configuration and publish to the operations center."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar indicator */}
        <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden my-1 border border-border/30">
          <div 
            className="bg-primary h-full transition-all duration-300 ease-out" 
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* STEP 1: Select Type */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-none">
              {MONITOR_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = watchType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeSelect(t.id)}
                    className={`group flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                      isSelected 
                        ? "border-primary bg-primary/[0.04] shadow-xs" 
                        : "border-border/60 bg-muted/10 hover:border-border/80 hover:bg-muted/20"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 transition-colors ${t.color}`}>
                      <Icon className="h-4 w-4 stroke-[2]" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-xs font-bold text-foreground block group-hover:text-primary transition-colors">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground block leading-tight font-medium">{t.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 2: Target & Name */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Friendly Name</Label>
                <Input 
                  id="name" 
                  {...form.register("name")} 
                  className="bg-background/50 border-border text-foreground rounded-xl placeholder:text-muted-foreground/60 text-xs focus-visible:ring-1 focus-visible:ring-ring" 
                  placeholder="Production Web Server" 
                />
                {form.formState.errors.name && <p className="text-[10px] text-destructive font-bold mt-1">{String(form.formState.errors.name.message)}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="url" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {["TCP", "PING"].includes(watchType) ? "Target Host / IP Address" : "Target URL"}
                </Label>
                <Input 
                  id="url" 
                  {...form.register("url")} 
                  className="bg-background/50 border-border text-foreground rounded-xl placeholder:text-muted-foreground/60 text-xs focus-visible:ring-1 focus-visible:ring-ring" 
                  placeholder={["TCP", "PING"].includes(watchType) ? "192.168.1.1" : "https://api.myserver.com/health"} 
                />
                {form.formState.errors.url && <p className="text-[10px] text-destructive font-bold mt-1">{String(form.formState.errors.url.message)}</p>}
              </div>

              {["TCP", "PING"].includes(watchType) && (
                <div className="space-y-1.5">
                  <Label htmlFor="tcpPort" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">TCP Port</Label>
                  <Input 
                    id="tcpPort" 
                    type="number"
                    {...form.register("tcpPort", { valueAsNumber: true })} 
                    className="bg-background/50 border-border text-foreground rounded-xl placeholder:text-muted-foreground/60 text-xs focus-visible:ring-1 focus-visible:ring-ring" 
                    placeholder="80" 
                  />
                  {form.formState.errors.tcpPort && <p className="text-[10px] text-destructive font-bold mt-1">{String(form.formState.errors.tcpPort.message)}</p>}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Advanced Options */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="monitorInterval" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Check Interval</Label>
                  <Select 
                    onValueChange={(v) => form.setValue("monitorInterval", parseInt(v || "5", 10))} 
                    defaultValue={String(form.getValues("monitorInterval"))}
                  >
                    <SelectTrigger className="bg-background/50 border-border text-foreground rounded-xl text-xs">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                      <SelectItem value="1">1 minute</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="timeoutMs" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Timeout (ms)</Label>
                  <Input 
                    id="timeoutMs" 
                    type="number"
                    {...form.register("timeoutMs", { valueAsNumber: true })} 
                    className="bg-background/50 border-border text-foreground rounded-xl text-xs focus-visible:ring-1 focus-visible:ring-ring" 
                  />
                </div>
              </div>

              {["HTTP", "HTTPS", "JSON_API"].includes(watchType) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="httpMethod" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">HTTP Method</Label>
                    <Select 
                      onValueChange={(v) => form.setValue("httpMethod", v as FormValues["httpMethod"])} 
                      defaultValue={form.getValues("httpMethod")}
                    >
                      <SelectTrigger className="bg-background/50 border-border text-foreground rounded-xl text-xs">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-card-foreground rounded-xl">
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="HEAD">HEAD</SelectItem>
                        <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="expectedStatusCode" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Expected Status Code</Label>
                    <Input 
                      id="expectedStatusCode" 
                      type="number"
                      placeholder="e.g. 200"
                      {...form.register("expectedStatusCode", { valueAsNumber: true })} 
                      className="bg-background/50 border-border text-foreground rounded-xl text-xs focus-visible:ring-1 focus-visible:ring-ring" 
                    />
                  </div>
                </div>
              )}

              {watchType === "JSON_API" && (
                <div className="grid grid-cols-2 gap-4 bg-muted/20 border border-border/40 p-3 rounded-xl">
                  <div className="space-y-1.5">
                    <Label htmlFor="jsonPath" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      JSON Path
                    </Label>
                    <Input 
                      id="jsonPath" 
                      placeholder="e.g. status.ok"
                      {...form.register("jsonPath")} 
                      className="bg-background border-border text-foreground rounded-xl text-xs focus-visible:ring-1" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="jsonPathExpected" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Expected Value</Label>
                    <Input 
                      id="jsonPathExpected" 
                      placeholder="e.g. true"
                      {...form.register("jsonPathExpected")} 
                      className="bg-background border-border text-foreground rounded-xl text-xs focus-visible:ring-1" 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="tagsInput" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tags (Comma-separated)</Label>
                <Input 
                  id="tagsInput" 
                  {...form.register("tagsInput")} 
                  className="bg-background/50 border-border text-foreground rounded-xl placeholder:text-muted-foreground/60 text-xs focus-visible:ring-1 focus-visible:ring-ring" 
                  placeholder="production, API, region-us" 
                />
              </div>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div className="space-y-3 font-mono text-[10px] bg-background/50 border border-border p-4 rounded-xl shadow-xs">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">PROBE NAME:</span>
                <span className="text-foreground font-bold">{form.getValues("name")}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">CHECK TYPE:</span>
                <span className="text-emerald-500 font-extrabold">{form.getValues("type")}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">TARGET HOST:</span>
                <span className="text-foreground font-bold truncate max-w-[220px]">{form.getValues("url")}</span>
              </div>
              {["TCP", "PING"].includes(watchType) && (
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">TCP PORT:</span>
                  <span className="text-foreground font-bold">{form.getValues("tcpPort")}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">INTERVAL:</span>
                <span className="text-foreground font-bold">{form.getValues("monitorInterval")} minutes</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">TIMEOUT LIMIT:</span>
                <span className="text-foreground font-bold">{form.getValues("timeoutMs")} ms</span>
              </div>
              {form.getValues("tagsInput") && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TAG LABELS:</span>
                  <span className="text-foreground font-bold">{form.getValues("tagsInput")}</span>
                </div>
              )}
            </div>
          )}

          {/* Dialog Action Buttons */}
          <DialogFooter className="mt-6 flex flex-row items-center justify-between sm:justify-between w-full">
            <div>
              {step > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={handleBack} 
                  className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>
              {step < 4 ? (
                <Button 
                  type="button" 
                  size="sm"
                  onClick={handleNext}
                  className="rounded-xl flex items-center gap-1.5 text-xs font-semibold"
                >
                  Next <ArrowRight className="h-3 w-3" />
                </Button>
              ) : (
                <Button 
                  type="button" 
                  size="sm"
                  onClick={() => {
                    console.log("Create button clicked!");
                    form.handleSubmit(
                      (values) => {
                        console.log("handleSubmit success:", values);
                        onSubmit(values);
                      },
                      (errors) => {
                        console.error("handleSubmit validation failed:", errors);
                      }
                    )();
                  }}
                  disabled={createMonitor.isPending}
                  className="rounded-xl flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs font-bold"
                >
                  {createMonitor.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>Create <Check className="h-3 w-3" /></>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
