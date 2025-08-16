import { Component, OnDestroy, afterNextRender } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-ecommerce',
    imports: [CommonModule, RouterModule],
    templateUrl: './EcommerceComponent.html',
    styles: [] // Removed reference to missing CSS file
})
export class EcommerceComponent implements OnDestroy {
  constructor() {
    // One-time initialization after the first render
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}

