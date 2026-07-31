import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LayerAdhesion } from "@/components/charts/lib/additive"
const materials = [
  { name: "Ti-6Al-4V, SLM", xyMpa: 1050, zMpa: 980, datasheetMpa: 1050 },
  { name: "AlSi10Mg, SLM", xyMpa: 440, zMpa: 390, datasheetMpa: 440 },
  { name: "PA12, SLS", xyMpa: 48, zMpa: 42, datasheetMpa: 48 },
  { name: "PLA, FFF", xyMpa: 58, zMpa: 22, datasheetMpa: 58 },
  { name: "PEEK, FFF", xyMpa: 96, zMpa: 41, datasheetMpa: 96 },
  { name: "316L, binder jet", xyMpa: 510, zMpa: 470, datasheetMpa: 520 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anisotropy</CardTitle>
        <CardDescription>In the layer plane against through it</CardDescription>
      </CardHeader>
      <CardContent>
        <LayerAdhesion materials={materials} requiredMpa={45} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A part that passes its coupon test and breaks in service <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Tensile, MPa
        </div>
      </CardFooter>
    </Card>
  )
}
