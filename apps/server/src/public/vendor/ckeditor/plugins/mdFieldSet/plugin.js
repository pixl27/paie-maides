(function () {
    CKEDITOR.plugins.add('mdFieldSet', {
        icons:      'frameset',
        init: function (editor) {
            editor.addCommand('insertFrameSet', {
                exec: function(editor) {
                    editor.insertHtml('<fieldset><legend>TITRE</legend>TEXT</fieldset>');
                }
            });
            editor.ui.addButton('mdFieldSet', {
                label:      'Insérer une frameset',
                command:    'insertFrameSet',
                toolbar:    'maides',
                icon: this.path + 'icons/frameset.png'
            });
        }
    }
);
})();