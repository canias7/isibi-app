import { TrendingUp } from "lucide-react"
import { Sankey } from "recharts"

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
const chartData = {
  nodes: [
    { name: "Search" },
    { name: "Social" },
    { name: "Direct" },
    { name: "Home page" },
    { name: "Prices" },
    { name: "Booked" },
    { name: "Left" },
  ],
  links: [
    { source: 0, target: 3, value: 320 },
    { source: 1, target: 3, value: 180 },
    { source: 2, target: 3, value: 140 },
    { source: 3, target: 4, value: 420 },
    { source: 3, target: 6, value: 220 },
    { source: 4, target: 5, value: 260 },
    { source: 4, target: 6, value: 160 },
  ],
}

const chartConfig = {
  value: { label: "People" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sankey</CardTitle>
        <CardDescription>Where visitors come from and where they go.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <Sankey data={chartData} node={{ fill: "var(--chart-1)" }} link={{ stroke: "var(--chart-2)", strokeOpacity: 0.4 }} nodePadding={20} />
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          38% of price-page visitors book <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
