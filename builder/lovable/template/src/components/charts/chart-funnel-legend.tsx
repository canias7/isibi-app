import { TrendingUp } from "lucide-react"
import { Funnel, FunnelChart } from "recharts"

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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
const chartData = [
  { stage: "Visits", value: 1200, fill: "var(--color-visits)" },
  { stage: "Viewed prices", value: 860, fill: "var(--color-viewed)" },
  { stage: "Started booking", value: 420, fill: "var(--color-started)" },
  { stage: "Confirmed", value: 260, fill: "var(--color-confirmed)" },
]

const chartConfig = {
  value: { label: "People" },
  visits: { label: "Visits", color: "var(--chart-1)" },
  viewed: { label: "Viewed prices", color: "var(--chart-2)" },
  started: { label: "Started booking", color: "var(--chart-3)" },
  confirmed: { label: "Confirmed", color: "var(--chart-4)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funnel Chart</CardTitle>
        <CardDescription>Visitors through to a confirmed booking.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <FunnelChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="stage" />} />
            <ChartLegend content={<ChartLegendContent nameKey="stage" />} />
            <Funnel dataKey="value" nameKey="stage" data={chartData} isAnimationActive={false} />
          </FunnelChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          22% reach a confirmed booking <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
