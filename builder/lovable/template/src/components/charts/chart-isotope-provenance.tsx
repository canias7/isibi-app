import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IsotopeProvenance } from "@/components/charts/lib/archaeology"
const references = [
  { name: "Chalk", x: 0.7085, y: -6.2, sdX: 0.0006, sdY: 0.5 },
  { name: "Granite", x: 0.7135, y: -5.1, sdX: 0.0012, sdY: 0.6 },
  { name: "Coastal", x: 0.7092, y: -3.8, sdX: 0.0008, sdY: 0.4 },
]
const samples = [
  { name: "Sk 4", x: 0.7086, y: -6.0 }, { name: "Sk 7", x: 0.7089, y: -6.4 },
  { name: "Sk 11", x: 0.7131, y: -5.3 }, { name: "Sk 12", x: 0.7093, y: -3.9 },
  { name: "Sk 15", x: 0.7112, y: -7.6 }, { name: "Sk 19", x: 0.7148, y: -2.4 },
  { name: "Sk 22", x: 0.7084, y: -6.1 }, { name: "Sk 26", x: 0.7104, y: -8.2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Isotope provenance</CardTitle>
        <CardDescription>Individuals against the reference regions</CardDescription>
      </CardHeader>
      <CardContent>
        <IsotopeProvenance
          samples={samples}
          references={references}
          axes={{ x: "⁸⁷Sr/⁸⁶Sr →", y: "δ¹⁸O" }}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Three did not grow up here <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Strontium and oxygen
        </div>
      </CardFooter>
    </Card>
  )
}
