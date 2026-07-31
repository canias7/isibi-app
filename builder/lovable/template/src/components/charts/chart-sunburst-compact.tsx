import { TrendingUp } from "lucide-react"
import { SunburstChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ChartConfig } from "@/components/ui/chart"
const chartData = {
  name: "All bookings",
  value: 600,
  children: [
    {
      name: "Cuts",
      value: 400,
      fill: "var(--chart-1)",
      children: [
        { name: "Fade", value: 250, fill: "var(--chart-2)" },
        { name: "Trim", value: 150, fill: "var(--chart-3)" },
      ],
    },
    { name: "Colour", value: 200, fill: "var(--chart-4)" },
  ],
}

const chartConfig = {
  value: { label: "Bookings" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sunburst Chart</CardTitle>
        <CardDescription>Bookings by service, then by variant.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <SunburstChart
            width={280}
            height={280}
            data={chartData}
            dataKey="value"
            innerRadius={40}
            textOptions={{ fontSize: "10", fill: "var(--background)" }}
          />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Fades are 62% of all cuts <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
