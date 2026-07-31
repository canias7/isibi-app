import { TrendingUp } from "lucide-react"
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts"

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
const chartData = [
  { spend: 12, bookings: 30, reach: 200 },
  { spend: 18, bookings: 52, reach: 260 },
  { spend: 24, bookings: 48, reach: 180 },
  { spend: 31, bookings: 88, reach: 400 },
  { spend: 39, bookings: 74, reach: 280 },
  { spend: 46, bookings: 110, reach: 340 },
  { spend: 54, bookings: 96, reach: 220 },
  { spend: 61, bookings: 132, reach: 380 },
]

const chartConfig = {
  bookings: { label: "Bookings", color: "var(--chart-1)" },
  reach: { label: "Reach", color: "var(--chart-2)" },
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
            <ReferenceLine x={36} stroke="var(--border)" />
            <ReferenceLine y={80} stroke="var(--border)" />
            <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent />} />
            <Scatter data={chartData} fill="var(--color-bookings)" />
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
