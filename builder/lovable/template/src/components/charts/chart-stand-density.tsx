import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StandDensity } from "@/components/charts/lib/forestry"
const plots = [
  { name: "Cpt 12 unthinned", stemsPerHa: 1450, meanDbhCm: 21 },
  { name: "Cpt 12 thinned", stemsPerHa: 820, meanDbhCm: 24 },
  { name: "Cpt 7", stemsPerHa: 620, meanDbhCm: 31 },
  { name: "Cpt 3", stemsPerHa: 2100, meanDbhCm: 15 },
  { name: "Cpt 19", stemsPerHa: 380, meanDbhCm: 42 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stand density</CardTitle>
        <CardDescription>Stems and diameter against the self-thinning limit</CardDescription>
      </CardHeader>
      <CardContent>
        <StandDensity plots={plots} maxSdi={1000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Thin now or the stand thins itself <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Reineke
        </div>
      </CardFooter>
    </Card>
  )
}
