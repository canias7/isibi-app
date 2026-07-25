import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/smoke')({ component: Smoke })

function Smoke() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground p-10 space-y-8">
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
          <Badge>Badge</Badge>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost">Hover me</Button></TooltipTrigger>
            <TooltipContent>A real tooltip</TooltipContent></Tooltip>
        </div>

        <Card className="max-w-md">
          <CardHeader><CardTitle>Card</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="e">Email</Label><Input id="e" placeholder="you@example.com" /></div>
            <Select><SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
              <SelectContent><SelectItem value="a">Option A</SelectItem><SelectItem value="b">Option B</SelectItem></SelectContent></Select>
            <div className="flex items-center gap-3"><Checkbox id="c" /><Label htmlFor="c">Checkbox</Label><Switch /></div>
            <Slider defaultValue={[40]} max={100} />
            <Progress value={62} />
          </CardContent>
        </Card>

        <Alert><AlertTitle>Heads up</AlertTitle><AlertDescription>This is an alert.</AlertDescription></Alert>

        <Tabs defaultValue="one" className="max-w-md">
          <TabsList><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two">Two</TabsTrigger></TabsList>
          <TabsContent value="one">Tab one body</TabsContent>
          <TabsContent value="two">Tab two body</TabsContent>
        </Tabs>

        <Accordion type="single" collapsible className="max-w-md">
          <AccordionItem value="i"><AccordionTrigger>Accordion</AccordionTrigger><AccordionContent>Body</AccordionContent></AccordionItem>
        </Accordion>

        <Table className="max-w-md">
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell>Ada</TableCell><TableCell>Admin</TableCell></TableRow></TableBody>
        </Table>

        <Dialog><DialogTrigger asChild><Button>Open dialog</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>A real dialog</DialogTitle></DialogHeader>
            <div className="flex items-center gap-3"><Avatar><AvatarFallback>AD</AvatarFallback></Avatar><span>with focus trapping</span></div>
          </DialogContent></Dialog>
      </div>
    </TooltipProvider>
  )
}
