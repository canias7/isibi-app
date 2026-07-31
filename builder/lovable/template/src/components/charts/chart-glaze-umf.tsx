import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GlazeUmf } from "@/components/charts/lib/ceramics"
// annotated: without it the differing flux keys widen to a union carrying
// ZnO?: undefined, which no longer satisfies Record<string, number>
const glazes: { name: string; fluxes: Record<string, number>; alumina: number; silica: number; boron?: number }[] = [
  { name: "Studio clear", fluxes: { KNaO: 0.28, CaO: 0.55, MgO: 0.09, ZnO: 0.08 }, alumina: 0.38, silica: 3.4, boron: 0.42 },
  { name: "Satin white", fluxes: { KNaO: 0.19, CaO: 0.44, MgO: 0.31, ZnO: 0.06 }, alumina: 0.51, silica: 2.9 },
  { name: "Celadon base", fluxes: { KNaO: 0.31, CaO: 0.62, MgO: 0.07 }, alumina: 0.42, silica: 3.9 },
  { name: "Matt liner", fluxes: { KNaO: 0.14, CaO: 0.68, MgO: 0.18 }, alumina: 0.61, silica: 2.4 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unity formula</CardTitle>
        <CardDescription>Two recipes made comparable</CardDescription>
      </CardHeader>
      <CardContent>
        <GlazeUmf glazes={glazes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A recipe in grams cannot be compared with another <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Cone 6 oxidation
        </div>
      </CardFooter>
    </Card>
  )
}
