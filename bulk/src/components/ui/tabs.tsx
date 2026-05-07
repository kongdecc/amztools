"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted/90 text-foreground/90 inline-flex h-11 w-fit items-center justify-center rounded-xl border border-border p-[3px]",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "bg-secondary/75 text-foreground/85 hover:bg-secondary hover:text-foreground data-[state=active]:bg-sky-100 data-[state=active]:text-sky-900 data-[state=active]:border-sky-300 data-[state=active]:shadow-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 dark:bg-muted/60 dark:text-foreground/90 dark:hover:bg-muted dark:data-[state=active]:bg-sky-900/45 dark:data-[state=active]:text-sky-100 dark:data-[state=active]:border-sky-700 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
