"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Loader2, Globe, Shield, Activity, Cpu, ArrowRight, ArrowLeft, Check, Plus, X 
} from "lucide-react";
import { useCreateMonitor } from "@/hooks/use-monitors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const MONITOR_TYPES = [
  { id: "HTTP", name: "HTTP", desc: "Basic web server probe", icon: Globe },
  { id: "HTTPS", name: "HTTPS", desc: "Secure HTTP probe", icon: Shield },
  { id: "TCP", name: "TCP Port Check", desc: "Monitor raw TCP connection", icon: Activity },
  { id: "SSL", name: "SSL Only", desc: "Check SSL certificate expiration", icon: Shield },
  { id: "PING", name: "Ping (TCP)", desc: "Simulated ICMP ping via TCP", icon: Cpu },
  { id: "JSON_API", name: "JSON API", desc: "Probe API and assert JSON keys", icon: Globe },
] as const;

const monitorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().min(1, "Target host or URL is required"),
  type: z.enum(["HTTP", "HTTPS", "TCP", "SSL", "PING", "JSON_API"]),
  monitorInterval: z.number().int().min(1),
  tagsInput: z.string().optional(),
  // Advanced fields
  httpMethod: z.enum(["GET", "POST", "PUT", "HEAD", "OPTIONS"]).optional(),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
  expectedStatusCode: z.number().int().min(100).max(599).optional(),
  jsonPath: z.string().optional(),
  jsonPathExpected: z.string().optional(),
  tcpPort: z.number().int().min(1).max(65535).optional(),
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

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const onSubmit = (values: FormValues) => {
    const tags = values.tagsInput 
      ? values.tagsInput.split(",").map(t => t.trim()).filter(Boolean) 
      : [];

    createMonitor.mutate(
      {
        name: values.name,
        url: values.url,
        type: values.type,
        monitorInterval: values.monitorInterval,
        tags,
        httpMethod: values.httpMethod,
        timeoutMs: values.timeoutMs,
        expectedStatusCode: values.expectedStatusCode,
        jsonPath: values.jsonPath,
        jsonPathExpected: values.jsonPathExpected,
        tcpPort: values.tcpPort,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setStep(1);
          form.reset();
        },
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
      <DialogContent className="bg-card border border-border text-card-foreground rounded-2xl p-6 max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="text-md font-bold tracking-tight text-foreground flex items-center justify-between">
            <span>Add Monitor Wizard</span>
            <span className="text-xs text-muted-foreground font-mono">Step {step} of 4</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {step === 1 && "Select the check type that suits your infrastructure component."}
            {step === 2 && "Enter target host/URL and give this probe a friendly name."}
            {step === 3 && "Tune interval, timeout, and configure advanced assertions."}
            {step === 4 && "Review your configuration and publish to the operations center."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* STEP 1: Select Type */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {MONITOR_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = watchType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeSelect(t.id)}
                    className={`flex flex-col items-start text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? "border-primary bg-primary/5 text-primary-foreground" 
                        : "border-border bg-background hover:border-border/80 text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5 text-emerald-500 mb-2" />
                    <span className="text-xs font-bold text-foreground">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground mt-1 leading-snug">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 2: Target & Name */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">Friendly Name</Label>
                <Input 
                  id="name" 
                  {...form.register("name")} 
                  className="bg-background border-border text-foreground rounded-xl" 
                  placeholder="Production Web Server" 
                />
                {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="url" className="text-xs font-semibold text-muted-foreground">
                  {["TCP", "PING"].includes(watchType) ? "Target Host / IP Address" : "Target URL"}
                </Label>
                <Input 
                  id="url" 
                  {...form.register("url")} 
                  className="bg-background border-border text-foreground rounded-xl" 
                  placeholder={["TCP", "PING"].includes(watchType) ? "192.168.1.1" : "https://api.myserver.com/health"} 
                />
                {form.formState.errors.url && <p className="text-xs text-destructive mt-1">{form.formState.errors.url.message}</p>}
              </div>

              {["TCP", "PING"].includes(watchType) && (
                <div className="space-y-1">
                  <Label htmlFor="tcpPort" className="text-xs font-semibold text-muted-foreground">TCP Port</Label>
                  <Input 
                    id="tcpPort" 
                    type="number"
                    {...form.register("tcpPort", { valueAsNumber: true })} 
                    className="bg-background border-border text-foreground rounded-xl" 
                    placeholder="80" 
                  />
                  {form.formState.errors.tcpPort && <p className="text-xs text-destructive mt-1">{form.formState.errors.tcpPort.message}</p>}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Advanced Options */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="monitorInterval" className="text-xs font-semibold text-muted-foreground">Check Interval</Label>
                  <Select 
                    onValueChange={(v) => form.setValue("monitorInterval", parseInt(v || "5", 10))} 
                    defaultValue={String(form.getValues("monitorInterval"))}
                  >
                    <SelectTrigger className="bg-background border-border text-foreground rounded-xl">
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

                <div className="space-y-1">
                  <Label htmlFor="timeoutMs" className="text-xs font-semibold text-muted-foreground">Timeout (ms)</Label>
                  <Input 
                    id="timeoutMs" 
                    type="number"
                    {...form.register("timeoutMs", { valueAsNumber: true })} 
                    className="bg-background border-border text-foreground rounded-xl" 
                  />
                </div>
              </div>

              {["HTTP", "HTTPS", "JSON_API"].includes(watchType) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="httpMethod" className="text-xs font-semibold text-muted-foreground">HTTP Method</Label>
                    <Select 
                      onValueChange={(v) => form.setValue("httpMethod", v as FormValues["httpMethod"])} 
                      defaultValue={form.getValues("httpMethod")}
                    >
                      <SelectTrigger className="bg-background border-border text-foreground rounded-xl">
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

                  <div className="space-y-1">
                    <Label htmlFor="expectedStatusCode" className="text-xs font-semibold text-muted-foreground">Expected Status Code</Label>
                    <Input 
                      id="expectedStatusCode" 
                      type="number"
                      placeholder="e.g. 200"
                      {...form.register("expectedStatusCode", { valueAsNumber: true })} 
                      className="bg-background border-border text-foreground rounded-xl" 
                    />
                  </div>
                </div>
              )}

              {watchType === "JSON_API" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="jsonPath" className="text-xs font-semibold text-muted-foreground">JSON Assertion Path</Label>
                    <Input 
                      id="jsonPath" 
                      placeholder="e.g. status.ok"
                      {...form.register("jsonPath")} 
                      className="bg-background border-border text-foreground rounded-xl" 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="jsonPathExpected" className="text-xs font-semibold text-muted-foreground">Expected Value</Label>
                    <Input 
                      id="jsonPathExpected" 
                      placeholder="e.g. true"
                      {...form.register("jsonPathExpected")} 
                      className="bg-background border-border text-foreground rounded-xl" 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="tagsInput" className="text-xs font-semibold text-muted-foreground">Tags (Comma-separated)</Label>
                <Input 
                  id="tagsInput" 
                  {...form.register("tagsInput")} 
                  className="bg-background border-border text-foreground rounded-xl" 
                  placeholder="production, API, region-us" 
                />
              </div>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div className="space-y-3 font-mono text-[11px] bg-background/50 border border-border p-4 rounded-xl">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">NAME:</span>
                <span className="text-foreground font-bold">{form.getValues("name")}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">TYPE:</span>
                <span className="text-emerald-500 font-bold">{form.getValues("type")}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">TARGET:</span>
                <span className="text-foreground font-bold truncate max-w-[200px]">{form.getValues("url")}</span>
              </div>
              {["TCP", "PING"].includes(watchType) && (
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">PORT:</span>
                  <span className="text-foreground font-bold">{form.getValues("tcpPort")}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">INTERVAL:</span>
                <span className="text-foreground font-bold">{form.getValues("monitorInterval")} minutes</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">TIMEOUT:</span>
                <span className="text-foreground font-bold">{form.getValues("timeoutMs")} ms</span>
              </div>
              {form.getValues("tagsInput") && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TAGS:</span>
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
                  className="rounded-xl flex items-center gap-1.5"
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
                className="rounded-xl"
              >
                Cancel
              </Button>
              {step < 4 ? (
                <Button 
                  type="button" 
                  size="sm"
                  onClick={handleNext}
                  className="rounded-xl flex items-center gap-1.5"
                  disabled={step === 1} // Step 1 triggers next on click of card
                >
                  Next <ArrowRight className="h-3 w-3" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={createMonitor.isPending}
                  className="rounded-xl flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
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
