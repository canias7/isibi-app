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
import { Bar, BarChart, CartesianGrid, ErrorBar, XAxis, YAxis } from "recharts"

const chartData = [
  { month: "January", mean: 186, err: 24 },
  { month: "February", mean: 305, err: 31 },
  { month: "March", mean: 237, err: 58 },
  { month: "April", mean: 173, err: 19 },
  { month: "May", mean: 209, err: 27 },
  { month: "June", mean: 214, err: 22 },
]

const chartConfig = {
  mean: { label: "Bookings", color: "var(--chart-1)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Bars</CardTitle>
        <CardDescription>Mean with its uncertainty.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => v.slice(0, 3)} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="mean" fill="var(--color-mean)" radius={4}>
              <ErrorBar dataKey="err" width={5} strokeWidth={1.5} stroke="var(--foreground)" />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          March is the least predictable <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
