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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

// One side negative, stackOffset="sign" — the same trick as a diverging bar,
// with age as the category axis.
const chartData = [
  { band: "18-24", a: -42, b: 38 },
  { band: "25-34", a: -88, b: 71 },
  { band: "35-44", a: -76, b: 64 },
  { band: "45-54", a: -51, b: 47 },
  { band: "55-64", a: -33, b: 29 },
  { band: "65+", a: -18, b: 21 },
]

const chartConfig = {
  a: { label: "Weekday", color: "var(--chart-1)" },
  b: { label: "Weekend", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Population Pyramid</CardTitle>
        <CardDescription>Customers by age band, split two ways.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart accessibilityLayer data={chartData} layout="vertical" stackOffset="sign" margin={{ left: 4 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => String(Math.abs(Number(v)))} />
            <YAxis dataKey="band" type="category" width={50} tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="a" stackId="a" fill="var(--color-a)" />
            <Bar dataKey="b" stackId="a" fill="var(--color-b)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The 30s are the biggest band <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
