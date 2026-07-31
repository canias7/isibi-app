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
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts"

const raw = [
  { cause: "Waiting", count: 42 },
  { cause: "Price", count: 31 },
  { cause: "Parking", count: 23 },
  { cause: "Booking", count: 14 },
  { cause: "Noise", count: 8 },
  { cause: "Other", count: 5 },
].sort((a, b) => b.count - a.count)

const grand = raw.reduce((s, r) => s + r.count, 0)
let run = 0
const chartData = raw.map((r) => {
  run += r.count
  return { ...r, cumulative: Math.round((run / grand) * 100) }
})

const chartConfig = {
  count: { label: "Complaints", color: "var(--chart-1)" },
  cumulative: { label: "Cumulative %", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pareto</CardTitle>
        <CardDescription>Causes descending, with the cumulative share.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ComposedChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="cause" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(v) => v + "%"} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar yAxisId="left" dataKey="count" fill="var(--color-count)" radius={4} />
            <Line yAxisId="right" dataKey="cumulative" type="monotone" stroke="var(--color-cumulative)" strokeWidth={2} dot={{ r: 3 }} />
            <ReferenceLine yAxisId="right" y={80} stroke="var(--color-cumulative)" strokeDasharray="4 4" />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three causes are 80% of complaints <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
