// Mounts every one of the 46 shadcn components inside a per-component error boundary.
// The `all.tsx` smoke test proves imports RESOLVE; this proves the components actually RENDER.
// A component that throws is reported by name rather than taking the page down with it.
import { Component, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar'
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuList, NavigationMenuTrigger } from '@/components/ui/navigation-menu'
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar, SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Toaster } from '@/components/ui/sonner'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Line, LineChart } from 'recharts'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// `form` is the one component that cannot be mounted from a static element — it needs a live
// react-hook-form context — so it gets a real wrapper rather than being quietly skipped.
const schema = z.object({ email: z.string().email('Enter a valid email') })

function FormCase() {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input placeholder="you@example.com" {...field} /></FormControl>
            <FormDescription>We never share it.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
      </form>
    </Form>
  )
}

export const Route = createFileRoute('/render-all')({ component: RenderAll })

class Boundary extends Component<{ name: string; children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { err: e instanceof Error ? e.message : String(e) } }
  render() {
    if (this.state.err) return <div data-crash={this.props.name} className="text-destructive text-xs">✗ {this.props.name}: {this.state.err}</div>
    return <div data-ok={this.props.name} className="rounded border border-border p-3">{this.props.children}</div>
  }
}

const CASES: Array<[string, ReactNode]> = [
  ['accordion', <Accordion type="single" collapsible><AccordionItem value="a"><AccordionTrigger>T</AccordionTrigger><AccordionContent>B</AccordionContent></AccordionItem></Accordion>],
  ['alert', <Alert><AlertTitle>T</AlertTitle><AlertDescription>D</AlertDescription></Alert>],
  ['alert-dialog', <AlertDialog><AlertDialogTrigger asChild><Button size="sm">x</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>T</AlertDialogTitle><AlertDialogDescription>D</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction>OK</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>],
  ['aspect-ratio', <AspectRatio ratio={16 / 9}><div className="bg-muted h-full w-full" /></AspectRatio>],
  ['avatar', <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>],
  ['badge', <Badge>badge</Badge>],
  ['breadcrumb', <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem></BreadcrumbList></Breadcrumb>],
  ['button', <Button size="sm">button</Button>],
  ['calendar', <Calendar mode="single" />],
  ['card', <Card><CardHeader><CardTitle>T</CardTitle></CardHeader><CardContent>B</CardContent></Card>],
  ['carousel', <Carousel className="w-40"><CarouselContent><CarouselItem>1</CarouselItem><CarouselItem>2</CarouselItem></CarouselContent><CarouselPrevious /><CarouselNext /></Carousel>],
  ['chart', <ChartContainer config={{ v: { label: 'V', color: 'var(--chart-1)' } }} className="h-24 w-40"><LineChart data={[{ v: 1 }, { v: 3 }, { v: 2 }]}><Line dataKey="v" /><ChartTooltip content={<ChartTooltipContent />} /></LineChart></ChartContainer>],
  ['checkbox', <Checkbox />],
  ['collapsible', <Collapsible><CollapsibleTrigger>toggle</CollapsibleTrigger><CollapsibleContent>body</CollapsibleContent></Collapsible>],
  ['command', <Command className="w-48"><CommandInput placeholder="search" /><CommandList><CommandEmpty>none</CommandEmpty><CommandGroup><CommandItem>one</CommandItem></CommandGroup></CommandList></Command>],
  ['context-menu', <ContextMenu><ContextMenuTrigger className="block border border-dashed p-2 text-xs">right-click</ContextMenuTrigger><ContextMenuContent><ContextMenuItem>item</ContextMenuItem></ContextMenuContent></ContextMenu>],
  ['dialog', <Dialog><DialogTrigger asChild><Button size="sm">x</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>T</DialogTitle></DialogHeader></DialogContent></Dialog>],
  ['drawer', <Drawer><DrawerTrigger asChild><Button size="sm">x</Button></DrawerTrigger><DrawerContent><DrawerHeader><DrawerTitle>T</DrawerTitle></DrawerHeader></DrawerContent></Drawer>],
  ['dropdown-menu', <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm">x</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>item</DropdownMenuItem></DropdownMenuContent></DropdownMenu>],
  ['hover-card', <HoverCard><HoverCardTrigger>hover</HoverCardTrigger><HoverCardContent>card</HoverCardContent></HoverCard>],
  ['input', <Input placeholder="input" />],
  ['input-otp', <InputOTP maxLength={4}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>],
  ['label', <Label>label</Label>],
  ['menubar', <Menubar><MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent><MenubarItem>New</MenubarItem></MenubarContent></MenubarMenu></Menubar>],
  ['navigation-menu', <NavigationMenu><NavigationMenuList><NavigationMenuItem><NavigationMenuTrigger>Menu</NavigationMenuTrigger><NavigationMenuContent>body</NavigationMenuContent></NavigationMenuItem></NavigationMenuList></NavigationMenu>],
  ['pagination', <Pagination><PaginationContent><PaginationItem><PaginationLink href="#">1</PaginationLink></PaginationItem></PaginationContent></Pagination>],
  ['popover', <Popover><PopoverTrigger asChild><Button size="sm">x</Button></PopoverTrigger><PopoverContent>body</PopoverContent></Popover>],
  ['progress', <Progress value={50} />],
  ['radio-group', <RadioGroup defaultValue="a"><RadioGroupItem value="a" /></RadioGroup>],
  // `orientation`, not `direction`: react-resizable-panels 4.x renamed it, and the template's
  // resizable.tsx already wraps the 4.x Group/Panel/Separator API. This file had the 3.x prop name,
  // which is what kept this step red.
  ['resizable', <ResizablePanelGroup orientation="horizontal" className="h-16 w-40"><ResizablePanel>A</ResizablePanel><ResizableHandle /><ResizablePanel>B</ResizablePanel></ResizablePanelGroup>],
  ['scroll-area', <ScrollArea className="h-16 w-40">scrolling body</ScrollArea>],
  ['select', <Select><SelectTrigger><SelectValue placeholder="pick" /></SelectTrigger><SelectContent><SelectItem value="a">A</SelectItem></SelectContent></Select>],
  ['separator', <Separator />],
  ['sheet', <Sheet><SheetTrigger asChild><Button size="sm">x</Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>T</SheetTitle></SheetHeader></SheetContent></Sheet>],
  ['sidebar', <SidebarProvider><Sidebar><SidebarContent><SidebarGroup><SidebarMenu><SidebarMenuItem><SidebarMenuButton>Item</SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup></SidebarContent></Sidebar></SidebarProvider>],
  ['skeleton', <Skeleton className="h-4 w-24" />],
  ['slider', <Slider defaultValue={[30]} max={100} />],
  ['sonner', <Toaster />],
  ['switch', <Switch />],
  ['table', <Table><TableHeader><TableRow><TableHead>H</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>C</TableCell></TableRow></TableBody></Table>],
  ['tabs', <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList><TabsContent value="a">body</TabsContent></Tabs>],
  ['textarea', <Textarea placeholder="textarea" />],
  ['toggle', <Toggle>toggle</Toggle>],
  ['toggle-group', <ToggleGroup type="single"><ToggleGroupItem value="a">A</ToggleGroupItem></ToggleGroup>],
  ['form', <FormCase />],
  ['tooltip', <Tooltip><TooltipTrigger asChild><Button size="sm">x</Button></TooltipTrigger><TooltipContent>tip</TooltipContent></Tooltip>],
]

function RenderAll() {
  return (
    <TooltipProvider>
      <div className="bg-background text-foreground min-h-screen p-6">
        <p data-total={CASES.length} className="mb-4 text-sm">Mounting {CASES.length} components</p>
        <div className="grid grid-cols-4 gap-3">
          {CASES.map(([name, node]) => <Boundary key={name} name={name}>{node}</Boundary>)}
        </div>
      </div>
    </TooltipProvider>
  )
}
