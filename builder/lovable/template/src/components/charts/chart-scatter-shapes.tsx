import { TrendingUp } from "lucide-react"
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts"

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
const seriesA = [
  { spend: 12, bookings: 30 }, { spend: 24, bookings: 48 },
  { spend: 39, bookings: 74 }, { spend: 54, bookings: 96 },
]
const seriesB = [
  { spend: 15, bookings: 62 }, { spend: 28, bookings: 84 },
  { spend: 42, bookings: 108 }, { spend: 58, bookings: 126 },
]

const chartConfig = {
  a: { label: "This year", color: "var(--chart-1)" },
  b: { label: "Last year", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scatter Chart</CardTitle>
        <CardDescription>Ad spend against bookings.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ScatterChart accessibilityLayer margin={{ left: 8, right: 8 }}>
            <CartesianGrid />
            <XAxis dataKey="spend" type="number" tickLine={false} axisLine={false} />
            <YAxis dataKey="bookings" type="number" tickLine={false} axisLine={false} />
            <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent />} />
            <Scatter name="a" data={seriesA} fill="var(--color-a)" shape="triangle" />
            <Scatter name="b" data={seriesB} fill="var(--color-b)" shape="square" />
          </ScatterChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Correlation holds above £30 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
