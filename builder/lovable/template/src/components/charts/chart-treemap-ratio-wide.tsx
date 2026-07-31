import { TrendingUp } from "lucide-react"
import { Treemap } from "recharts"

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
  { name: "Haircut", size: 412, fill: "var(--chart-1)" },
  { name: "Beard trim", size: 266, fill: "var(--chart-2)" },
  { name: "Hot towel", size: 139, fill: "var(--chart-3)" },
  { name: "Colour", size: 96, fill: "var(--chart-4)" },
  { name: "Kids cut", size: 64, fill: "var(--chart-5)" },
]

const chartConfig = {
  size: { label: "Revenue" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Treemap</CardTitle>
        <CardDescription>Revenue by service, area to scale.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <Treemap data={chartData} dataKey="size" aspectRatio={16 / 9} isAnimationActive={false} stroke="var(--background)" />
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Haircuts are 42% of revenue <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
