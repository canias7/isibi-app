import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { CartesianGrid, ComposedChart, Line, Scatter, XAxis, YAxis } from "recharts"

const chartData = [
  { service: "Haircut", before: 380, after: 412 },
  { service: "Beard", before: 291, after: 266 },
  { service: "Towel", before: 150, after: 139 },
  { service: "Colour", before: 52, after: 96 },
  { service: "Kids", before: 58, after: 64 },
]

const chartConfig = {
  before: { label: "Last half", color: "var(--chart-2)" },
  after: { label: "This half", color: "var(--chart-1)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dumbbell</CardTitle>
        <CardDescription>Before and after, per category.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ComposedChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis dataKey="service" type="category" width={64} tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="before" stroke="none" dot={{ r: 4, fill: "var(--color-before)" }} activeDot={false} isAnimationActive={false} />
            <Line dataKey="after" stroke="none" dot={{ r: 4, fill: "var(--color-after)" }} activeDot={false} isAnimationActive={false} />
            <Scatter dataKey="after" fill="var(--color-after)" />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour grew most <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
