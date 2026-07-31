import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ForecastAccuracy } from "@/components/charts/lib/contact"
const days = [
  { label: "M", forecast: 1840, actual: 1988 }, { label: "T", forecast: 1760, actual: 1842 },
  { label: "W", forecast: 1690, actual: 1801 }, { label: "T", forecast: 1620, actual: 1594 },
  { label: "F", forecast: 1510, actual: 1662 }, { label: "M", forecast: 1880, actual: 2041 },
  { label: "T", forecast: 1790, actual: 1874 }, { label: "W", forecast: 1710, actual: 1748 },
  { label: "T", forecast: 1640, actual: 1701 }, { label: "F", forecast: 1520, actual: 1611 },
  { label: "M", forecast: 1860, actual: 1922 }, { label: "T", forecast: 1770, actual: 1901 },
  { label: "W", forecast: 1700, actual: 1664 }, { label: "T", forecast: 1630, actual: 1742 },
  { label: "F", forecast: 1500, actual: 1584 }, { label: "M", forecast: 1900, actual: 2064 },
  { label: "T", forecast: 1810, actual: 1846 }, { label: "W", forecast: 1720, actual: 1812 },
  { label: "T", forecast: 1650, actual: 1688 }, { label: "F", forecast: 1540, actual: 1642 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast error</CardTitle>
        <CardDescription>Size and direction, separated</CardDescription>
      </CardHeader>
      <CardContent>
        <ForecastAccuracy days={days} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Under-forecasting costs service, over-forecasting costs money <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four weeks
        </div>
      </CardFooter>
    </Card>
  )
}
