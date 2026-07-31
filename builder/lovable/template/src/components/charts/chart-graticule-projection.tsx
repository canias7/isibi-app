import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Graticule } from "@/components/charts/lib/carto"
const places = [
  { lon: -0.13, lat: 51.51, label: "London", weight: 1 },
  { lon: -74.0, lat: 40.71, label: "New York", weight: 0.86 },
  { lon: 139.69, lat: 35.69, label: "Tokyo", weight: 0.62 },
  { lon: 151.21, lat: -33.87, label: "Sydney", weight: 0.34 },
  { lon: 18.42, lat: -33.92, label: "Cape Town", weight: 0.21 },
  { lon: -46.63, lat: -23.55, label: "São Paulo", weight: 0.44 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where our customers are</CardTitle>
        <CardDescription>Equirectangular world grid</CardDescription>
      </CardHeader>
      <CardContent>
        <Graticule points={places} step={30} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Six markets on three continents <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Weighted by revenue
        </div>
      </CardFooter>
    </Card>
  )
}
