import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShapWaterfall } from "@/components/charts/lib/mldata"
const contributions = [
  { feature: "credit history", value: "8 yrs", shap: 0.14 },
  { feature: "debt-to-income", value: "0.46", shap: -0.09 },
  { feature: "recent enquiries", value: "4", shap: -0.06 },
  { feature: "income", value: "£54k", shap: 0.05 },
  { feature: "employment", value: "permanent", shap: 0.03 },
  { feature: "address stability", value: "2 yrs", shap: -0.02 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Why this prediction</CardTitle>
        <CardDescription>Feature contributions from the base rate</CardDescription>
      </CardHeader>
      <CardContent>
        <ShapWaterfall baseValue={0.31} contributions={contributions} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The contributions sum to the prediction <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One applicant
        </div>
      </CardFooter>
    </Card>
  )
}
