import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HertzsprungRussell } from "@/components/charts/lib/aero"
const seq = Array.from({ length: 60 }, (_, i) => {
  const t = 3000 * Math.pow(28000 / 3000, i / 59)
  return { tempK: Math.round(t), luminosity: Math.pow(t / 5772, 5.2) }
})
const named = [
  { name: "Sun", tempK: 5772, luminosity: 1 },
  { name: "Sirius A", tempK: 9940, luminosity: 25 },
  { name: "Betelgeuse", tempK: 3600, luminosity: 90000 },
  { name: "Rigel", tempK: 12100, luminosity: 47000 },
  { name: "Proxima", tempK: 3040, luminosity: 0.0017 },
  { name: "Sirius B", tempK: 25000, luminosity: 0.026 },
  { name: "Arcturus", tempK: 4290, luminosity: 170 },
]
const stars = [...seq, ...named]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hertzsprung–Russell</CardTitle>
        <CardDescription>Luminosity against temperature</CardDescription>
      </CardHeader>
      <CardContent>
        <HertzsprungRussell stars={stars} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The reversed axis is what makes the diagonal <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Nearby stars
        </div>
      </CardFooter>
    </Card>
  )
}
