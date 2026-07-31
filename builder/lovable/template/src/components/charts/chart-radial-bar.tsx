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
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts"

const chartData = [
  { service: "Haircut", value: 412, fill: "var(--chart-1)" },
  { service: "Beard", value: 266, fill: "var(--chart-2)" },
  { service: "Towel", value: 139, fill: "var(--chart-3)" },
  { service: "Colour", value: 96, fill: "var(--chart-4)" },
]

const chartConfig = {
  value: { label: "Bookings" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Radial Bar</CardTitle>
        <CardDescription>Bars wrapped around a circle.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[270px] w-full">
          <RadialBarChart data={chartData} innerRadius="26%" outerRadius="96%" startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 460]} tick={false} />
            <ChartTooltip content={<ChartTooltipContent nameKey="service" />} />
            <RadialBar dataKey="value" background cornerRadius={4} />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Haircuts fill the ring <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
